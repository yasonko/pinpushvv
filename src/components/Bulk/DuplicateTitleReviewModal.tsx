import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Check, 
  Sparkles, 
  RotateCcw, 
  Edit3, 
  CheckCircle2, 
  X, 
  FileText, 
  ChevronRight, 
  SlidersHorizontal,
  RefreshCw,
  Info
} from 'lucide-react';
import { Pin } from '../../types';
import { 
  TitleChangeRecord, 
  detectDuplicateTitles, 
  normalizeTitleForComparison, 
  clampTitleLength 
} from '../../services/titleDuplicateService';

interface DuplicateTitleReviewModalProps {
  pins: Pin[];
  changes: TitleChangeRecord[];
  onApplyChanges: (updatedPins: Pin[]) => void;
  onClose: () => void;
  isAutoFixing?: boolean;
}

export const DuplicateTitleReviewModal: React.FC<DuplicateTitleReviewModalProps> = ({
  pins,
  changes: initialChanges,
  onApplyChanges,
  onClose,
  isAutoFixing = false,
}) => {
  // Working list of pins being edited/reviewed
  const [workingPins, setWorkingPins] = useState<Pin[]>(pins);
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [tempEditTitle, setTempEditTitle] = useState<string>('');

  // Track user modifications/reversions
  const [activeChanges, setActiveChanges] = useState<TitleChangeRecord[]>(initialChanges);

  // Real-time scan of working pins
  const scanResult = useMemo(() => {
    return detectDuplicateTitles(workingPins);
  }, [workingPins]);

  const handleStartEdit = (pinId: string, currentTitle: string) => {
    setEditingPinId(pinId);
    setTempEditTitle(currentTitle);
  };

  const handleSaveEdit = (pinId: string, originalTitle: string, pinIndex: number) => {
    const cleaned = clampTitleLength(tempEditTitle.trim(), 100);
    if (!cleaned) return;

    setWorkingPins(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.id === pinId);
      if (idx !== -1) {
        next[idx] = { ...next[idx], title: cleaned, titleManuallyEdited: true };
      }
      return next;
    });

    setActiveChanges(prev => {
      const existingIdx = prev.findIndex(c => c.pinId === pinId);
      const record: TitleChangeRecord = {
        pinId,
        pinIndex,
        filename: workingPins.find(p => p.id === pinId)?.filename || `pin_${pinIndex + 1}.jpg`,
        originalTitle,
        newTitle: cleaned,
        reason: 'Manually edited by user in review',
        characterCount: cleaned.length,
        isUserModified: true,
      };

      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = record;
        return next;
      }
      return [...prev, record];
    });

    setEditingPinId(null);
    setTempEditTitle('');
  };

  const handleRestoreOriginal = (pinId: string, originalTitle: string) => {
    setWorkingPins(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.id === pinId);
      if (idx !== -1) {
        next[idx] = { ...next[idx], title: originalTitle };
      }
      return next;
    });

    setActiveChanges(prev => prev.filter(c => c.pinId !== pinId));
    setEditingPinId(null);
  };

  const handleApplyAll = () => {
    if (scanResult.hasDuplicates) {
      alert(`Please resolve the remaining ${scanResult.duplicatesCount} duplicate title(s) before applying changes.`);
      return;
    }
    onApplyChanges(workingPins);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
      <div className="bg-white/95 dark:bg-black/95 dark:backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-white/[0.08] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Review Unique Pin Titles
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pinterest rejects duplicate row titles. Inspect and fine-tune SEO rewrites.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Validation Status Banner */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-black/60">
          {scanResult.hasDuplicates ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  ⚠ {scanResult.duplicatesCount} duplicate title(s) still remaining. All Pin titles must be unique to export to Pinterest.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  ✓ All {workingPins.length} Pins now have 100% unique, Pinterest-ready titles.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Changes List Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-black/40">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Rewritten Duplicate Titles ({activeChanges.length})</span>
            <span>Max 100 chars per title</span>
          </div>

          {activeChanges.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-white/[0.02] rounded-2xl border border-slate-200 dark:border-white/[0.08] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Duplicate Titles Detected
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                All Pins in this batch currently have unique, distinct titles.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeChanges.map((change) => {
                const currentPin = workingPins.find(p => p.id === change.pinId);
                const currentTitle = currentPin?.title || change.newTitle;
                const isEditing = editingPinId === change.pinId;
                const isDup = scanResult.duplicatePinIds.has(change.pinId);

                return (
                  <div
                    key={change.pinId}
                    className={`p-4 bg-white dark:bg-white/[0.02] border rounded-2xl transition-all shadow-xs space-y-3 ${
                      isDup
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/20 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-white/[0.08]'
                    }`}
                  >
                    {/* Pin Identifier & Status */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] font-mono font-bold text-slate-700 dark:text-slate-300">
                          Pin #{change.pinIndex + 1}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px] truncate max-w-[160px]">
                          {change.filename}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isDup ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                            <AlertTriangle className="w-3 h-3" /> Duplicate
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                            <Check className="w-3 h-3" /> Unique
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-slate-400">
                          {currentTitle.length}/100 chars
                        </span>
                      </div>
                    </div>

                    {/* Before & After Comparison */}
                    <div className="space-y-2 text-xs">
                      {/* Before */}
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06]">
                        <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-0.5">
                          Before (Original Duplicate):
                        </div>
                        <div className="line-through text-slate-400 dark:text-slate-500 font-medium">
                          {change.originalTitle}
                        </div>
                      </div>

                      {/* After / Editable */}
                      {isEditing ? (
                        <div className="p-2.5 rounded-xl bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-2">
                          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#E60023]">
                            <span>Edit Unique SEO Title:</span>
                            <span className={tempEditTitle.length > 100 ? 'text-red-600 font-bold' : 'text-slate-400'}>
                              {tempEditTitle.length}/100
                            </span>
                          </div>
                          <input
                            type="text"
                            value={tempEditTitle}
                            maxLength={100}
                            onChange={(e) => setTempEditTitle(e.target.value)}
                            className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-black/60 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E60023]"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingPinId(null)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(change.pinId, change.originalTitle, change.pinIndex)}
                              className="px-3 py-1 bg-[#E60023] hover:bg-red-700 text-white font-bold text-[11px] rounded-lg cursor-pointer"
                            >
                              Save Title
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                          <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                            After (New Unique Pinterest SEO Title):
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {currentTitle}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions: Keep, Edit, Restore */}
                    {!isEditing && (
                      <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-100 dark:border-white/[0.06]">
                        <span className="text-[10px] text-slate-400 italic">
                          {change.reason}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(change.pinId, currentTitle)}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRestoreOriginal(change.pinId, change.originalTitle)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                            title="Restore original title (may cause duplicate export warning)"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApplyAll}
            disabled={scanResult.hasDuplicates}
            className="px-5 py-2.5 bg-[#E60023] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Apply Unique Titles & Return to Export</span>
          </button>
        </div>
      </div>
    </div>
  );
};
