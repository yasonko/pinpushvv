import React from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Download, 
  Eye, 
  Trash2, 
  Sparkles,
  Layers,
  Clock
} from 'lucide-react';
import { CleanedImageItem } from '../../types/imageCleaner';
import { imageCleanerQueue } from '../../services/imageCleanerQueue';

interface ImageQueueGridProps {
  items: CleanedImageItem[];
  onOpenDetails: (item: CleanedImageItem) => void;
  onOpenMetadata: (item: CleanedImageItem) => void;
  onRemoveItem: (id: string) => void;
}

export const ImageQueueGrid: React.FC<ImageQueueGridProps> = ({
  items,
  onOpenDetails,
  onOpenMetadata,
  onRemoveItem,
}) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item, idx) => {
        const original = item.originalFile;
        const processed = item.processedFile;
        const metaBefore = item.metadataBefore;

        return (
          <div
            key={item.id}
            className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col group"
          >
            {/* Image Preview Container */}
            <div 
              onClick={() => onOpenDetails(item)}
              className="relative aspect-[3/4] bg-slate-100 dark:bg-black/80 overflow-hidden cursor-pointer flex items-center justify-center"
            >
              <img
                src={processed?.downloadUrl || item.thumbnailUrl}
                alt="Preview"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Status Badge */}
              <div className="absolute top-2.5 left-2.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm border ${
                  item.status === 'success'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : item.status === 'warning'
                    ? 'bg-amber-500 text-white border-amber-400'
                    : item.status === 'failed'
                    ? 'bg-rose-600 text-white border-rose-500'
                    : item.status === 'idle'
                    ? 'bg-black/80 text-white border-white/[0.12] backdrop-blur-sm'
                    : 'bg-indigo-600 text-white border-indigo-500'
                }`}>
                  {item.status === 'normalizing'
                    ? 'Processing'
                    : item.status === 'success'
                    ? '✓ Requested Cleanup Verified'
                    : item.status === 'warning'
                    ? '⚠ Processed with warnings'
                    : item.status === 'failed'
                    ? '✕ Processing failed'
                    : item.status}
                </span>
              </div>

              {/* GPS Warning Badge */}
              {metaBefore?.hasGps && (
                <div className="absolute top-2.5 right-2.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-sm border border-rose-500">
                    GPS
                  </span>
                </div>
              )}

              {/* Hover Quick Actions */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(item);
                  }}
                  className="p-2 rounded-xl bg-white/90 dark:bg-black/90 dark:backdrop-blur-md text-slate-800 dark:text-slate-100 hover:scale-110 transition-transform shadow-lg cursor-pointer border border-transparent dark:border-white/[0.12]"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMetadata(item);
                  }}
                  className="p-2 rounded-xl bg-white/90 dark:bg-black/90 dark:backdrop-blur-md text-indigo-600 dark:text-indigo-400 hover:scale-110 transition-transform shadow-lg cursor-pointer border border-transparent dark:border-white/[0.12]"
                  title="Inspect Metadata"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
                {processed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      imageCleanerQueue.downloadSingle(item);
                    }}
                    className="p-2 rounded-xl bg-[#E60023] text-white hover:scale-110 transition-transform shadow-lg cursor-pointer border border-red-500"
                    title="Download Clean Image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Card Content */}
            <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate font-mono" title={original.name}>
                  {original.name}
                </div>
                {processed?.name && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate flex items-center gap-1 mt-0.5" title={processed.name}>
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span className="truncate">{processed.name}</span>
                  </div>
                )}

                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono">
                  <div className="flex justify-between">
                    <span>Dimensions:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {processed ? `${processed.width}×${processed.height}` : `${original.width}×${original.height}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>File Size:</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {processed ? formatBytes(processed.size) : formatBytes(original.size)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar & Remove */}
              <div className="pt-2 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between">
                <div className="w-full mr-3">
                  <div className="w-full bg-slate-100 dark:bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        item.status === 'success'
                          ? 'bg-emerald-500'
                          : item.status === 'warning'
                          ? 'bg-amber-500'
                          : item.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
