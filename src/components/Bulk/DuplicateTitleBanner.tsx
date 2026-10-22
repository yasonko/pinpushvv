import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Eye, 
  Wand2, 
  RefreshCw, 
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';
import { Pin } from '../../types';
import { 
  detectDuplicateTitles, 
  autoFixDuplicateTitles, 
  TitleChangeRecord 
} from '../../services/titleDuplicateService';
import { DuplicateTitleReviewModal } from './DuplicateTitleReviewModal';

interface DuplicateTitleBannerProps {
  pins: Pin[];
  onPinsUpdated: (updatedPins: Pin[]) => void;
  className?: string;
  onOpenReviewModal?: () => void;
}

export const DuplicateTitleBanner: React.FC<DuplicateTitleBannerProps> = ({
  pins,
  onPinsUpdated,
  className = '',
}) => {
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [changesList, setChangesList] = useState<TitleChangeRecord[]>([]);
  const [autoFixSuccessMsg, setAutoFixSuccessMsg] = useState<string | null>(null);

  const scan = detectDuplicateTitles(pins);

  const handleAutoFix = async () => {
    if (!scan.hasDuplicates) return;
    setIsAutoFixing(true);
    setAutoFixSuccessMsg(null);

    try {
      const result = await autoFixDuplicateTitles(pins);
      setChangesList(result.changes);
      onPinsUpdated(result.updatedPins);
      setAutoFixSuccessMsg(
        `Successfully auto-rewrote ${result.duplicatesDetected} duplicate title(s) to unique Pinterest SEO titles.`
      );
    } catch (err: any) {
      console.error('[Duplicate Title Auto-Fix] Error:', err);
    } finally {
      setIsAutoFixing(false);
    }
  };

  return (
    <>
      <div className={`p-4 rounded-2xl border transition-all ${className} ${
        scan.hasDuplicates
          ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 shadow-xs'
          : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Details */}
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
              scan.hasDuplicates
                ? 'bg-amber-200/80 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-transparent dark:border-amber-800/60'
                : 'bg-emerald-200/80 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-transparent dark:border-emerald-800/60'
            }`}>
              {scan.hasDuplicates ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Title Validation
                </span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  scan.hasDuplicates
                    ? 'bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100'
                    : 'bg-emerald-200 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-100'
                }`}>
                  {scan.uniqueTitlesCount} / {scan.totalPins} Unique
                </span>
              </div>

              {scan.hasDuplicates ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    ⚠ {scan.duplicatesCount} duplicate {scan.duplicatesCount === 1 ? 'title' : 'titles'} detected across {scan.duplicateGroups.size} group(s).
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300/90">
                    Pinterest Bulk Upload rejects CSVs containing multiple rows with the same title.
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    ✓ {scan.totalPins} Pins &bull; {scan.uniqueTitlesCount} unique titles
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300/80">
                    All titles are distinct and compliant with Pinterest Bulk Upload specifications (≤ 100 chars).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {scan.hasDuplicates ? (
              <>
                <button
                  type="button"
                  onClick={handleAutoFix}
                  disabled={isAutoFixing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E60023] hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  title="Keep first pin title unchanged and auto-generate unique Pinterest SEO titles for subsequent duplicates"
                >
                  <Wand2 className={`w-3.5 h-3.5 ${isAutoFixing ? 'animate-spin' : ''}`} />
                  <span>{isAutoFixing ? 'Fixing Titles...' : 'Auto-Fix Duplicates'}</span>
                </button>

                {changesList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-black/60 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 font-bold text-xs rounded-xl hover:bg-amber-100/50 dark:hover:bg-amber-950/40 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Review Changes</span>
                  </button>
                )}
              </>
            ) : changesList.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-black/60 border border-emerald-300 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 font-bold text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Review Rewritten Titles ({changesList.length})</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Success Message Banner */}
        {autoFixSuccessMsg && (
          <div className="mt-2.5 pt-2 border-t border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{autoFixSuccessMsg}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="text-[#E60023] dark:text-red-400 underline font-bold cursor-pointer"
            >
              Inspect Changes
            </button>
          </div>
        )}
      </div>

      {/* Review Modal Dialog */}
      {showReviewModal && (
        <DuplicateTitleReviewModal
          pins={pins}
          changes={changesList}
          onApplyChanges={(updated) => {
            onPinsUpdated(updated);
            setShowReviewModal(false);
          }}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </>
  );
};
