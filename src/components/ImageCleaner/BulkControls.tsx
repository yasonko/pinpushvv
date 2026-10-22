import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCw, 
  XSquare, 
  Download, 
  Trash2, 
  LayoutList, 
  LayoutGrid, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  UploadCloud,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ImageCleanerQueueState } from '../../services/imageCleanerQueue';

interface BulkControlsProps {
  queueState: ImageCleanerQueueState;
  viewMode: 'table' | 'grid';
  onToggleViewMode: (mode: 'table' | 'grid') => void;
  onStartProcessing: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
  onDownloadZip: () => void;
  onSendToPinLibrary?: () => void;
  onClearAll: () => void;
}

export const BulkControls: React.FC<BulkControlsProps> = ({
  queueState,
  viewMode,
  onToggleViewMode,
  onStartProcessing,
  onPause,
  onResume,
  onCancel,
  onRetryFailed,
  onDownloadZip,
  onSendToPinLibrary,
  onClearAll,
}) => {
  const {
    totalCount,
    completedCount,
    successCount,
    warningCount,
    failedCount,
    globalProgress,
    isProcessing,
    isPaused,
  } = queueState;

  const readyToDownloadCount = successCount + warningCount;

  return (
    <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-4 shadow-sm">
      {/* Top Row: Main Trigger & Status Counters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Processing buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!isProcessing && (
            <button
              type="button"
              disabled={totalCount === 0 || completedCount === totalCount}
              onClick={onStartProcessing}
              className="px-5 py-2.5 rounded-xl bg-[#E60023] hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-[#E60023] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Clean Metadata & Normalize All ({totalCount})</span>
            </button>
          )}

          {isProcessing && !isPaused && (
            <button
              type="button"
              onClick={onPause}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Pause className="w-4 h-4" />
              <span>Pause Processing</span>
            </button>
          )}

          {isProcessing && isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>Resume Processing</span>
            </button>
          )}

          {isProcessing && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-700 hover:text-rose-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <XSquare className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}

          {failedCount > 0 && !isProcessing && (
            <button
              type="button"
              onClick={onRetryFailed}
              className="px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4 text-rose-500" />
              <span>Retry Failed ({failedCount})</span>
            </button>
          )}
        </div>

        {/* Right: Export & Utility buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Download ZIP */}
          <button
            type="button"
            disabled={readyToDownloadCount === 0}
            onClick={onDownloadZip}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download All as ZIP {readyToDownloadCount > 0 && `(${readyToDownloadCount})`}</span>
          </button>

          {/* Send directly to Pin Publisher Pro Library */}
          {onSendToPinLibrary && (
            <button
              type="button"
              disabled={readyToDownloadCount === 0}
              onClick={onSendToPinLibrary}
              className="px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-white/[0.04] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-white/[0.08] border border-indigo-200 dark:border-indigo-800/60 disabled:opacity-40 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Import Cleaned to Pin Library</span>
            </button>
          )}

          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => onToggleViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Table View"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Clear Queue */}
          <button
            type="button"
            disabled={totalCount === 0 || isProcessing}
            onClick={onClearAll}
            className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 transition-colors cursor-pointer"
            title="Clear Queue"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress & Stat Banner */}
      {totalCount > 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] space-y-2">
          <div className="flex flex-wrap items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {isProcessing ? 'Processing Queue:' : 'Queue Status:'}
              </span>
              <span className="font-mono text-slate-900 dark:text-white font-bold">
                {completedCount} / {totalCount} processed ({globalProgress}%)
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{successCount} Verified</span>
              </div>
              {warningCount > 0 && (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{warningCount} Warnings</span>
                </div>
              )}
              {failedCount > 0 && (
                <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{failedCount} Failed</span>
                </div>
              )}
            </div>
          </div>

          {/* Large Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-white/[0.06] rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                failedCount > 0 && successCount === 0
                  ? 'bg-rose-500'
                  : isProcessing
                  ? 'bg-indigo-600'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
