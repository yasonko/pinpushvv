import { Pin, Board, PinterestAccount, PublishQueueItem } from '../types';
import { dbService } from './db';
import { pinterestService, PinterestApiError } from './pinterestApi';

export type QueueSubscriber = (items: PublishQueueItem[]) => void;

class PublishQueueManager {
  private queue: PublishQueueItem[] = [];
  private subscribers: Set<QueueSubscriber> = new Set();
  private isProcessing = false;

  subscribe(callback: QueueSubscriber): () => void {
    this.subscribers.add(callback);
    callback(this.getQueue());
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    const copy = this.getQueue();
    this.subscribers.forEach(cb => cb(copy));
  }

  getQueue(): PublishQueueItem[] {
    return [...this.queue];
  }

  getStats() {
    const total = this.queue.length;
    const queued = this.queue.filter(q => q.status === 'queued').length;
    const publishing = this.queue.filter(q => q.status === 'publishing').length;
    const completed = this.queue.filter(q => q.status === 'completed').length;
    const failed = this.queue.filter(q => q.status === 'failed').length;
    return { total, queued, publishing, completed, failed };
  }

  clearCompleted() {
    this.queue = this.queue.filter(q => q.status !== 'completed');
    this.notify();
  }

  clearAll() {
    this.queue = [];
    this.notify();
  }

  removePinFromQueue(pinIds: string[]) {
    const set = new Set(pinIds);
    this.queue = this.queue.filter(q => !set.has(q.pinId));
    this.notify();
  }

  async enqueuePins(
    pinsToPublish: Pin[],
    boards: Board[],
    account: PinterestAccount | null,
    onPinUpdated?: (updatedPin: Pin) => void
  ) {
    const boardMap = new Map(boards.map(b => [b.id, b]));

    for (const pin of pinsToPublish) {
      // Avoid duplicate queue items for same pin
      const existing = this.queue.find(q => q.pinId === pin.id);
      if (existing) {
        existing.status = 'queued';
        existing.error = null;
      } else {
        const board = pin.boardId ? boardMap.get(pin.boardId) : undefined;
        this.queue.push({
          id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          pinId: pin.id,
          filename: pin.filename,
          thumbnailUrl: pin.thumbnailUrl,
          title: pin.title || pin.filename,
          boardName: board?.name,
          status: 'queued',
          error: null,
          startedAt: null,
          completedAt: null,
        });
      }
    }

    this.notify();
    this.processQueue(boards, account, onPinUpdated);
  }

  async retryFailed(boards: Board[], account: PinterestAccount | null, onPinUpdated?: (updatedPin: Pin) => void) {
    this.queue.forEach(q => {
      if (q.status === 'failed') {
        q.status = 'queued';
        q.error = null;
      }
    });
    this.notify();
    this.processQueue(boards, account, onPinUpdated);
  }

  async retrySingle(pinId: string, boards: Board[], account: PinterestAccount | null, onPinUpdated?: (updatedPin: Pin) => void) {
    const item = this.queue.find(q => q.pinId === pinId);
    if (item) {
      item.status = 'queued';
      item.error = null;
      this.notify();
      this.processQueue(boards, account, onPinUpdated);
    }
  }

  private async processQueue(
    boards: Board[],
    account: PinterestAccount | null,
    onPinUpdated?: (updatedPin: Pin) => void
  ) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const boardMap = new Map(boards.map(b => [b.id, b]));
      const allPins = await dbService.getAllPins();
      const pinMap = new Map(allPins.map(p => [p.id, p]));

      while (true) {
        const nextItem = this.queue.find(q => q.status === 'queued');
        if (!nextItem) break;

        nextItem.status = 'publishing';
        nextItem.startedAt = new Date().toISOString();
        this.notify();

        const pin = pinMap.get(nextItem.pinId);
        if (!pin) {
          nextItem.status = 'failed';
          nextItem.error = 'Pin data not found';
          this.notify();
          continue;
        }

        // Set pin status to publishing
        const publishingPin: Pin = { ...pin, status: 'publishing' };
        await dbService.savePin(publishingPin);
        if (onPinUpdated) onPinUpdated(publishingPin);

        try {
          if (!account || !account.accessToken || !account.isConnected) {
            throw new PinterestApiError(
              'Pinterest connection required. Connect your Pinterest account or provide a valid access token in Settings.',
              401
            );
          }

          const board = pin.boardId ? boardMap.get(pin.boardId) : undefined;
          const pinterestBoardId = board?.pinterestBoardId || pin.boardId;

          if (!pinterestBoardId) {
            throw new PinterestApiError(
              'Please assign a valid Board before publishing this Pin.',
              400
            );
          }

          // Call real Pinterest API
          const response = await pinterestService.createPin(pin, pinterestBoardId, account.accessToken);

          // Success!
          const publishedPin: Pin = {
            ...pin,
            status: 'published',
            publishedAt: response.created_at || new Date().toISOString(),
            pinterestPinId: response.id,
            errorMessage: null,
            updatedAt: new Date().toISOString(),
          };

          await dbService.savePin(publishedPin);
          if (onPinUpdated) onPinUpdated(publishedPin);

          nextItem.status = 'completed';
          nextItem.completedAt = new Date().toISOString();
        } catch (err: any) {
          const errMsg = err?.message || 'Publishing failed';
          const failedPin: Pin = {
            ...pin,
            status: 'failed',
            errorMessage: errMsg,
            updatedAt: new Date().toISOString(),
          };

          await dbService.savePin(failedPin);
          if (onPinUpdated) onPinUpdated(failedPin);

          nextItem.status = 'failed';
          nextItem.error = errMsg;
        }

        this.notify();
        // Slight throttle between Pinterest API calls (300ms) to avoid rate limits
        await new Promise(r => setTimeout(r, 300));
      }
    } finally {
      this.isProcessing = false;
      this.notify();
    }
  }
}

export const publishQueue = new PublishQueueManager();
