import React from 'react';
import { 
  X, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  RefreshCw, 
  Send,
  Sparkles,
  Layers
} from 'lucide-react';
import { PublishQueueItem, Board, PinterestAccount, Pin } from '../../types';
import { publishQueue } from '../../services/publishEngine';

interface PublishQueueModalProps {
  queueItems: PublishQueueItem[];
  boards: Board[];
  pinterestAccount: PinterestAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onPinUpdated: (pin: Pin) => void;
}

export const PublishQueueModal: React.FC<PublishQueueModalProps> = ({
  queueItems,
  boards,
  pinterestAccount,
  isOpen,
  onClose,
  onPinUpdated,
}) => {
  if (!isOpen) return null;

  const total = queueItems.length;
  const queued = queueItems.filter(q => q.status === 'queued').length;
  const publishing = queueItems.filter(q => q.status === 'publishing').length;
  const completed = queueItems.filter(q => q.status === 'completed').length;
  const failed = queueItems.filter(q => q.status === 'failed').length;

  const progressPercent = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  const handleRetryFailed = () => {
    publishQueue.retryFailed(boards, pinterestAccount, onPinUpdated);
  };

  const handleRetrySingle = (pinId: string) => {
    publishQueue.retrySingle(pinId, boards, pinterestAccount, onPinUpdated);
  };

  const handleClearCompleted = () => {
    publishQueue.clearCompleted();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Pinterest Publishing Queue</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {total} total items in queue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Metrics Progress Bar */}
        <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-800/80 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-700 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Queued</span>
              <span className="font-mono text-base font-bold text-slate-200">{queued}</span>
            </div>
            <div className="bg-slate-800/80 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-700 dark:border-slate-800">
              <span className="text-blue-400 block text-[10px] uppercase font-bold">Publishing</span>
              <span className="font-mono text-base font-bold text-blue-400">{publishing}</span>
            </div>
            <div className="bg-slate-800/80 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-700 dark:border-slate-800">
              <span className="text-emerald-400 block text-[10px] uppercase font-bold">Completed</span>
              <span className="font-mono text-base font-bold text-emerald-400">{completed}</span>
            </div>
            <div className="bg-slate-800/80 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-700 dark:border-slate-800">
              <span className="text-rose-400 block text-[10px] uppercase font-bold">Failed</span>
              <span className="font-mono text-base font-bold text-rose-400">{failed}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>Batch Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-700 dark:border-slate-800">
              <div
                className="h-full bg-rose-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {queueItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
              No active or pending publishing tasks in the queue.
            </div>
          ) : (
            queueItems.map((item) => (
              <div
                key={item.id}
                className="pt-2 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="w-7 h-10 object-cover rounded bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700"
                  />
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate" title={item.title}>
                      {item.title || item.filename}
                    </h4>
                    {item.error ? (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 truncate font-mono" title={item.error}>
                        {item.error}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                        {item.boardName || 'Assigning Board'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.status === 'queued' && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <Clock className="w-3 h-3" /> Queued
                    </span>
                  )}
                  {item.status === 'publishing' && (
                    <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                      <RotateCw className="w-3 h-3 animate-spin" /> Publishing...
                    </span>
                  )}
                  {item.status === 'completed' && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Published
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" /> Failed
                      </span>
                      <button
                        onClick={() => handleRetrySingle(item.pinId)}
                        className="text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <div className="flex gap-2">
            {failed > 0 && (
              <button
                onClick={handleRetryFailed}
                className="flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry All Failed ({failed})</span>
              </button>
            )}
            {completed > 0 && (
              <button
                onClick={handleClearCompleted}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                Clear Completed
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
