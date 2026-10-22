import JSZip from 'jszip';
import { 
  CleanedImageItem, 
  ImageCleanerSettings, 
  DEFAULT_CLEANER_SETTINGS 
} from '../types/imageCleaner';
import { 
  parseImageMetadata, 
  processImagePipeline 
} from './imageCleanerEngine';

export interface ImageCleanerQueueState {
  items: CleanedImageItem[];
  isProcessing: boolean;
  isPaused: boolean;
  globalProgress: number; // 0 - 100
  currentIndex: number;
  totalCount: number;
  completedCount: number;
  successCount: number;
  warningCount: number;
  failedCount: number;
  activeWorkers: number;
  elapsedMs: number;
}

type Listener = (state: ImageCleanerQueueState) => void;

class ImageCleanerQueueManager {
  private items: CleanedImageItem[] = [];
  private isProcessing = false;
  private isPaused = false;
  private cancelRequested = false;
  private listeners: Set<Listener> = new Set();
  private settings: ImageCleanerSettings = { ...DEFAULT_CLEANER_SETTINGS };
  private activeWorkers = 0;
  private startTime: number = 0;

  constructor() {
    //
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    for (const l of this.listeners) {
      try {
        l(state);
      } catch (err) {
        console.error('[Cleaner Queue] Listener error:', err);
      }
    }
  }

  public getState(): ImageCleanerQueueState {
    const totalCount = this.items.length;
    const successCount = this.items.filter(i => i.status === 'success').length;
    const warningCount = this.items.filter(i => i.status === 'warning').length;
    const failedCount = this.items.filter(i => i.status === 'failed').length;
    const completedCount = successCount + warningCount + failedCount;
    const globalProgress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return {
      items: [...this.items],
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      globalProgress,
      currentIndex: completedCount,
      totalCount,
      completedCount,
      successCount,
      warningCount,
      failedCount,
      activeWorkers: this.activeWorkers,
      elapsedMs: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  /**
   * Adds uploaded raw files to queue.
   */
  public async addFiles(files: File[]): Promise<void> {
    const newItems: CleanedImageItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `cleaner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`;
      const objectUrl = URL.createObjectURL(file);

      // Create lightweight thumbnail
      let thumb = objectUrl;
      let width = 0;
      let height = 0;

      try {
        const img = new Image();
        img.src = objectUrl;
        await new Promise((resolve) => {
          img.onload = () => {
            width = img.naturalWidth;
            height = img.naturalHeight;
            resolve(true);
          };
          img.onerror = () => resolve(false);
        });
      } catch {
        // fallback
      }

      const item: CleanedImageItem = {
        id,
        file,
        originalFile: {
          name: file.name,
          size: file.size,
          width,
          height,
          format: file.type || 'image/jpeg',
          lastModified: file.lastModified,
        },
        thumbnailUrl: thumb,
        objectUrl,
        status: 'idle',
        subSteps: {
          validate: 'pending',
          readMetadata: 'pending',
          cleanMetadata: 'pending',
          normalize: 'pending',
          rename: 'pending',
          export: 'pending',
          verify: 'pending',
        },
        progress: 0,
      };

      // Read initial metadata in background without blocking
      parseImageMetadata(file).then(meta => {
        const target = this.items.find(it => it.id === id);
        if (target) {
          target.metadataBefore = meta;
          this.notify();
        }
      }).catch(() => {});

      newItems.push(item);
    }

    this.items = [...this.items, ...newItems];
    this.notify();
  }

  /**
   * Starts processing all pending or idle items with concurrency limit.
   */
  public async startProcessing(customSettings?: ImageCleanerSettings): Promise<void> {
    if (this.isProcessing && !this.isPaused) return;

    if (customSettings) {
      this.settings = { ...customSettings };
    }

    this.isProcessing = true;
    this.isPaused = false;
    this.cancelRequested = false;
    if (this.startTime === 0) this.startTime = Date.now();
    this.notify();

    const pendingItems = this.items.filter(
      item => item.status === 'idle' || item.status === 'failed'
    );

    const concurrency = Math.max(1, Math.min(6, this.settings.concurrency || 3));
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < pendingItems.length && !this.cancelRequested) {
        if (this.isPaused) {
          await new Promise(r => setTimeout(r, 200));
          continue;
        }

        const itemIndex = nextIndex++;
        const currentItem = pendingItems[itemIndex];
        if (!currentItem) break;

        this.activeWorkers++;
        this.notify();

        const globalIdx = this.items.findIndex(it => it.id === currentItem.id);
        const processed = await processImagePipeline(
          currentItem,
          globalIdx >= 0 ? globalIdx : itemIndex,
          this.settings,
          (step, state, prog) => {
            const it = this.items.find(i => i.id === currentItem.id);
            if (it) {
              it.subSteps[step] = state;
              it.progress = prog;
              it.status = 'normalizing';
              this.notify();
            }
          }
        );

        const targetIdx = this.items.findIndex(it => it.id === currentItem.id);
        if (targetIdx >= 0) {
          this.items[targetIdx] = processed;
        }

        this.activeWorkers--;
        this.notify();
      }
    };

    // Run parallel workers up to concurrency limit
    const workerPromises: Promise<void>[] = [];
    for (let w = 0; w < Math.min(concurrency, pendingItems.length); w++) {
      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);

    this.isProcessing = false;
    this.isPaused = false;
    this.activeWorkers = 0;
    this.notify();
  }

  public pause(): void {
    if (this.isProcessing) {
      this.isPaused = true;
      this.notify();
    }
  }

  public resume(settings?: ImageCleanerSettings): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.notify();
    } else if (!this.isProcessing) {
      this.startProcessing(settings);
    }
  }

  public cancel(): void {
    this.cancelRequested = true;
    this.isProcessing = false;
    this.isPaused = false;
    this.activeWorkers = 0;
    this.notify();
  }

  public retryFailed(settings?: ImageCleanerSettings): void {
    // Reset failed items to idle
    this.items = this.items.map(item => {
      if (item.status === 'failed') {
        return {
          ...item,
          status: 'idle',
          progress: 0,
          subSteps: {
            validate: 'pending',
            readMetadata: 'pending',
            cleanMetadata: 'pending',
            normalize: 'pending',
            rename: 'pending',
            export: 'pending',
            verify: 'pending',
          },
          error: undefined,
        };
      }
      return item;
    });

    this.startProcessing(settings);
  }

  public removeItem(id: string): void {
    const item = this.items.find(it => it.id === id);
    if (item) {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
      if (item.processedFile?.downloadUrl) URL.revokeObjectURL(item.processedFile.downloadUrl);
    }
    this.items = this.items.filter(it => it.id !== id);
    this.notify();
  }

  public clearAll(): void {
    this.cancel();
    for (const item of this.items) {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
      if (item.processedFile?.downloadUrl) URL.revokeObjectURL(item.processedFile.downloadUrl);
    }
    this.items = [];
    this.startTime = 0;
    this.notify();
  }

  /**
   * Generates and downloads a ZIP package containing all processed images.
   */
  public async downloadZip(filename?: string): Promise<void> {
    const successfulItems = this.items.filter(
      it => (it.status === 'success' || it.status === 'warning') && it.processedFile
    );

    if (successfulItems.length === 0) {
      throw new Error('No processed images ready to download.');
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const item of successfulItems) {
      if (!item.processedFile) continue;
      let finalName = item.processedFile.name || `image_${item.id}.jpg`;

      // Prevent duplicate names in ZIP
      if (usedNames.has(finalName)) {
        const base = finalName.replace(/\.[^/.]+$/, '');
        const ext = finalName.substring(finalName.lastIndexOf('.'));
        let counter = 1;
        while (usedNames.has(`${base}_${counter}${ext}`)) {
          counter++;
        }
        finalName = `${base}_${counter}${ext}`;
      }
      usedNames.add(finalName);

      zip.file(finalName, item.processedFile.blob);
    }

    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const defaultZipName = `processed-images-${dateStr}.zip`;
    const targetZipName = filename || defaultZipName;

    const downloadLink = document.createElement('a');
    const zipUrl = URL.createObjectURL(content);
    downloadLink.href = zipUrl;
    downloadLink.download = targetZipName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setTimeout(() => URL.revokeObjectURL(zipUrl), 30000);
  }

  /**
   * Downloads a single processed image file.
   */
  public downloadSingle(item: CleanedImageItem): void {
    if (!item.processedFile) return;
    const a = document.createElement('a');
    a.href = item.processedFile.downloadUrl;
    a.download = item.processedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export const imageCleanerQueue = new ImageCleanerQueueManager();
