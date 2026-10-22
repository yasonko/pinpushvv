import React from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  Download, 
  ShieldCheck, 
  FileCode, 
  ImageIcon,
  Maximize2,
  HardDrive,
  Clock,
  Sparkles
} from 'lucide-react';
import { CleanedImageItem } from '../../types/imageCleaner';
import { imageCleanerQueue } from '../../services/imageCleanerQueue';

interface ProcessingDetailsModalProps {
  item: CleanedImageItem | null;
  onClose: () => void;
  onOpenMetadataInspector?: (item: CleanedImageItem) => void;
}

export const ProcessingDetailsModal: React.FC<ProcessingDetailsModalProps> = ({
  item,
  onClose,
  onOpenMetadataInspector,
}) => {
  if (!item) return null;

  const original = item.originalFile;
  const processed = item.processedFile;
  const diff = item.metadataDiff;
  const verification = item.verification;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-white/95 dark:bg-black/90 dark:backdrop-blur-2xl w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-white/[0.04] border border-emerald-200 dark:border-white/[0.08] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Image Normalization & Processing Details
                </h3>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 border ${
                  item.status === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : item.status === 'warning'
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}>
                  {item.status === 'success'
                    ? '✓ Requested Cleanup Verified'
                    : item.status === 'warning'
                    ? '⚠ Processed with warnings'
                    : '✕ Processing failed'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {original.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* 3-Stage Pipeline Breakdown (Original -> Changes -> Final) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Original */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Original File</span>
              </div>
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 dark:bg-black border border-slate-200 dark:border-white/[0.08] flex items-center justify-center">
                <img
                  src={item.thumbnailUrl}
                  alt="Original"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 font-mono">
                <div className="truncate font-semibold text-slate-800 dark:text-slate-200" title={original.name}>
                  {original.name}
                </div>
                <div>Size: {formatBytes(original.size)}</div>
                <div>Dim: {original.width} × {original.height} px</div>
                <div className="uppercase">Format: {original.format.replace('image/', '')}</div>
              </div>
            </div>

            {/* 2. Changes Applied */}
            <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Modifications</span>
              </div>
              <div className="p-3 bg-white/80 dark:bg-black/60 rounded-lg border border-indigo-100 dark:border-indigo-900/60 space-y-2 text-xs">
                <div className="flex items-center justify-between text-indigo-950 dark:text-indigo-200">
                  <span>EXIF Removed:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {diff?.exifRemoved ?? 0} fields
                  </span>
                </div>
                <div className="flex items-center justify-between text-indigo-950 dark:text-indigo-200">
                  <span>IPTC Cleaned:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {diff?.iptcRemoved ?? 0} fields
                  </span>
                </div>
                <div className="flex items-center justify-between text-indigo-950 dark:text-indigo-200">
                  <span>GPS / Location:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {diff?.gpsRemoved ? 'Stripped ✓' : 'Clean'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-indigo-950 dark:text-indigo-200">
                  <span>Camera Details:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {diff?.cameraRemoved ? 'Removed ✓' : 'Clean'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-indigo-950 dark:text-indigo-200">
                  <span>Filename:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    SEO Renamed ✓
                  </span>
                </div>
              </div>
              {item.durationMs && (
                <div className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>Processing Time: {(item.durationMs / 1000).toFixed(2)}s</span>
                </div>
              )}
            </div>

            {/* 3. Final Output */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Final Output</span>
              </div>
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 dark:bg-black border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                <img
                  src={processed?.downloadUrl || item.thumbnailUrl}
                  alt="Processed"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1 text-xs text-emerald-900 dark:text-emerald-200 font-mono">
                <div className="truncate font-semibold text-emerald-800 dark:text-emerald-100" title={processed?.name}>
                  {processed?.name || '—'}
                </div>
                <div>
                  Size: {processed ? formatBytes(processed.size) : '—'}
                  {processed?.reductionPercent ? (
                    <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      ({processed.reductionPercent > 0 ? `-${processed.reductionPercent}%` : `+${Math.abs(processed.reductionPercent)}%`})
                    </span>
                  ) : null}
                </div>
                <div>Dim: {processed ? `${processed.width} × ${processed.height} px` : '—'}</div>
                <div className="uppercase">Format: {processed?.format.replace('image/', '') || '—'}</div>
              </div>
            </div>
          </div>

          {/* Quality & Verification Checklist */}
          <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                <ShieldCheck className={`w-4 h-4 ${item.status === 'warning' ? 'text-amber-500' : item.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`} />
                <span>End-to-End Post-Export Verification Audit</span>
              </div>
              <span className={`text-[11px] font-bold ${
                item.status === 'warning'
                  ? 'text-amber-600 dark:text-amber-400'
                  : item.status === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                {item.status === 'success' ? '✓ Requested Cleanup Verified' : item.status === 'warning' ? '⚠ Processed with warnings' : '✕ Processing failed'}
              </span>
            </div>

            <div className="p-4 divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
              {verification?.auditItems && verification.auditItems.length > 0 ? (
                verification.auditItems.map((audit, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {audit.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {audit.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-bold ${
                        audit.passed
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {audit.statusText}
                      </span>
                      {audit.reason && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {audit.reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Image Pixel Integrity & Decoding
                      </span>
                    </div>
                    <span className="text-slate-500 font-mono">
                      {verification?.fileOpensCorrectly ? '✓ Decoded Successfully' : '—'}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Correct Dimensions & Aspect Ratio
                      </span>
                    </div>
                    <span className="text-slate-500 font-mono">
                      {verification?.aspectRatioPreserved ? '✓ Exact Ratio Preserved' : '—'}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {verification?.metadataCleanupVerified ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Camera & Privacy Cleanup
                      </span>
                    </div>
                    <span className={`font-mono font-bold ${
                      verification?.metadataCleanupVerified
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {verification?.metadataCleanupVerified ? '✓ Requested Cleanup Verified' : '⚠ Warnings Detected'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Exact Retained Field Warnings with Field & Reason format */}
          {verification?.retainedFieldWarnings && verification.retainedFieldWarnings.length > 0 && (
            <div className="p-4 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Retained Metadata Warning ({verification.retainedFieldWarnings.length} Field{verification.retainedFieldWarnings.length > 1 ? 's' : ''}):</span>
              </div>
              <div className="space-y-2">
                {verification.retainedFieldWarnings.map((itemWarning, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-amber-100/80 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 text-xs font-mono"
                  >
                    <div className="text-amber-950 dark:text-amber-100 font-bold">
                      Field:
                    </div>
                    <div className="text-amber-900 dark:text-amber-200 pl-2">
                      {itemWarning.field}
                    </div>
                    <div className="text-amber-950 dark:text-amber-100 font-bold mt-1">
                      Reason:
                    </div>
                    <div className="text-amber-800 dark:text-amber-300 pl-2">
                      {itemWarning.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings list if any other strings present */}
          {item.warnings && item.warnings.length > 0 && (!verification?.retainedFieldWarnings || verification.retainedFieldWarnings.length === 0) && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Identified Processing Warnings:</span>
              </div>
              <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-400 space-y-1 font-mono">
                {item.warnings.map((w, i) => (
                  <li key={i} className="break-all whitespace-pre-line">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Error Message if failed */}
          {item.error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-300">
                <XCircle className="w-4 h-4 text-rose-500" />
                <span>Processing Error:</span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-400 font-mono">
                {item.error}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3">
          {onOpenMetadataInspector && (
            <button
              onClick={() => {
                onClose();
                onOpenMetadataInspector(item);
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>View Full Metadata Diff</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {processed && (
              <button
                onClick={() => imageCleanerQueue.downloadSingle(item)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#E60023] hover:bg-red-700 text-white flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Cleaned File</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-200 dark:bg-white/[0.06] hover:bg-slate-300 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
