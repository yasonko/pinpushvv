import React from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Download, 
  Eye, 
  Trash2, 
  RotateCw,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { CleanedImageItem } from '../../types/imageCleaner';
import { imageCleanerQueue } from '../../services/imageCleanerQueue';

interface ImageQueueTableProps {
  items: CleanedImageItem[];
  onOpenDetails: (item: CleanedImageItem) => void;
  onOpenMetadata: (item: CleanedImageItem) => void;
  onRemoveItem: (id: string) => void;
}

export const ImageQueueTable: React.FC<ImageQueueTableProps> = ({
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
    <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
            <tr>
              <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] w-12 text-center">#</th>
              <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] w-16">Preview</th>
              <th className="p-3.5 font-bold uppercase tracking-wider text-[11px]">Filename (Before → After)</th>
              <th className="p-3.5 font-bold uppercase tracking-wider text-[11px]">Dimensions</th>
              <th className="p-3.5 font-bold uppercase tracking-wider text-[11px]">File Size</th>
              <th className="p-3.5 font-bold uppercase tracking-wider text-[11px]">Privacy & EXIF</th>
              <th className="p-3.5 font-bold uppercase tracking-wider text-[11px]">Pipeline Progress</th>
              <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {items.map((item, idx) => {
              const original = item.originalFile;
              const processed = item.processedFile;
              const metaBefore = item.metadataBefore;
              const metaAfter = item.metadataAfter;

              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors group"
                >
                  {/* Index */}
                  <td className="p-3.5 text-center font-mono text-slate-400 text-xs">
                    {idx + 1}
                  </td>

                  {/* Thumbnail */}
                  <td className="p-3.5">
                    <div 
                      onClick={() => onOpenDetails(item)}
                      className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-black/80 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity relative shrink-0"
                    >
                      <img
                        src={processed?.downloadUrl || item.thumbnailUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </td>

                  {/* Filenames */}
                  <td className="p-3.5 max-w-[220px]">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900 dark:text-white truncate font-mono text-xs" title={original.name}>
                        {original.name}
                      </div>
                      {processed?.name ? (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate flex items-center gap-1" title={processed.name}>
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span className="truncate">{processed.name}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-mono">Pending processing...</div>
                      )}
                    </div>
                  </td>

                  {/* Dimensions */}
                  <td className="p-3.5 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                    <div className="space-y-0.5">
                      <div>{original.width} × {original.height} px</div>
                      {processed && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          → {processed.width} × {processed.height} px
                        </div>
                      )}
                    </div>
                  </td>

                  {/* File Size */}
                  <td className="p-3.5 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                    <div className="space-y-0.5">
                      <div>{formatBytes(original.size)}</div>
                      {processed && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          → {formatBytes(processed.size)}
                          {processed.reductionPercent ? (
                            <span className="ml-1 text-[10px] px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-850">
                              ({processed.reductionPercent > 0 ? `-${processed.reductionPercent}%` : `+${Math.abs(processed.reductionPercent)}%`})
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Privacy & EXIF audit */}
                  <td className="p-3.5 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <button
                        type="button"
                        onClick={() => onOpenMetadata(item)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors font-mono text-[10px] font-semibold cursor-pointer"
                      >
                        <ShieldCheck className="w-3 h-3 text-indigo-500" />
                        <span>
                          {metaBefore ? `${metaBefore.totalFieldCount} tags` : 'Detecting...'}
                        </span>
                      </button>

                      {metaBefore?.hasGps && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[9px] font-bold border border-rose-200 dark:border-rose-800/60">
                          GPS Detected
                        </span>
                      )}

                      {item.status === 'success' && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>✓ Requested Cleanup Verified</span>
                        </span>
                      )}

                      {item.status === 'warning' && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1" title={item.warnings?.join(' | ')}>
                          <AlertTriangle className="w-3 h-3" />
                          <span>⚠ Processed with warnings</span>
                        </span>
                      )}

                      {item.status === 'failed' && (
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          <span>✕ Processing failed</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Pipeline Progress */}
                  <td className="p-3.5 min-w-[200px]">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          item.status === 'success'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                            : item.status === 'warning'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                            : item.status === 'failed'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                            : item.status === 'idle'
                            ? 'bg-slate-100 dark:bg-white/[0.04] text-slate-500 border-slate-200 dark:border-white/[0.08]'
                            : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                        }`}>
                          {item.status === 'normalizing'
                            ? 'Processing...'
                            : item.status === 'success'
                            ? '✓ Requested Cleanup Verified'
                            : item.status === 'warning'
                            ? '⚠ Processed with warnings'
                            : item.status === 'failed'
                            ? '✕ Processing failed'
                            : item.status}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{item.progress}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
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

                      {/* Sub-step indicator pills */}
                      <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400">
                        <span className={item.subSteps.validate === 'success' ? 'text-emerald-600 font-bold' : ''}>Val</span>
                        <span>•</span>
                        <span className={item.subSteps.readMetadata === 'success' ? 'text-emerald-600 font-bold' : ''}>Meta</span>
                        <span>•</span>
                        <span className={item.subSteps.cleanMetadata === 'success' ? 'text-emerald-600 font-bold' : ''}>Clean</span>
                        <span>•</span>
                        <span className={item.subSteps.normalize === 'success' ? 'text-emerald-600 font-bold' : ''}>Norm</span>
                        <span>•</span>
                        <span className={item.subSteps.export === 'success' ? 'text-emerald-600 font-bold' : ''}>Exp</span>
                        <span>•</span>
                        <span className={
                          item.subSteps.verify === 'success'
                            ? 'text-emerald-600 font-bold'
                            : item.subSteps.verify === 'warning'
                            ? 'text-amber-600 font-bold'
                            : ''
                        }>
                          Ver{item.subSteps.verify === 'warning' ? '⚠️' : ''}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenDetails(item)}
                        title="View Detailed Results"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {processed && (
                        <button
                          type="button"
                          onClick={() => imageCleanerQueue.downloadSingle(item)}
                          title="Download Clean File"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        title="Remove from queue"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
