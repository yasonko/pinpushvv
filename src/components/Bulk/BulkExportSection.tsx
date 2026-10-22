import React, { useState, useMemo } from 'react';
import { 
  Download, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Sparkles, 
  Info, 
  RotateCw, 
  Globe,
  CalendarRange,
  Layers
} from 'lucide-react';
import { Pin, Board } from '../../types';
import { 
  validatePinsForExport, 
  downloadPinterestCSV, 
  BatchExportValidation,
  PINTEREST_CSV_COLUMNS
} from '../../services/csvEngine';
import { preparePinsForExportWithMediaUrls, PreparePinsResult } from '../../services/imageStorageService';
import { 
  BulkScheduleConfig, 
  BulkSchedulePreview, 
  getDefaultBulkScheduleConfig, 
  calculateBulkSchedulePreview, 
  applyScheduleToPins 
} from '../../services/bulkScheduleService';
import { 
  detectDuplicateTitles, 
  autoFixDuplicateTitles 
} from '../../services/titleDuplicateService';
import { BulkScheduleSettings } from './BulkScheduleSettings';
import { DuplicateTitleBanner } from './DuplicateTitleBanner';

interface BulkExportSectionProps {
  pins: Pin[];
  selectedPins?: Pin[];
  boards: Board[];
  onOpenImportCsv?: () => void;
  onPinsUpdated?: (updatedPins: Pin[]) => void;
  className?: string;
  variant?: 'card' | 'compact' | 'sidebar';
}

export const BulkExportSection: React.FC<BulkExportSectionProps> = ({
  pins,
  selectedPins,
  boards,
  onOpenImportCsv,
  onPinsUpdated,
  className = '',
  variant = 'card'
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [exportSuccessMsg, setExportSuccessMsg] = useState<{
    text: string;
    totalPins: number;
    uploadedCount: number;
    existingCount: number;
    scheduledCount: number;
  } | null>(null);

  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showProblemDetails, setShowProblemDetails] = useState(false);
  const [failedUploads, setFailedUploads] = useState<Array<{ pin: Pin; pinNumber: number; title: string; error: string }>>([]);

  // Export Scope: 'selected' vs 'all'
  const [exportScope, setExportScope] = useState<'selected' | 'all'>(
    selectedPins && selectedPins.length > 0 ? 'selected' : 'all'
  );

  React.useEffect(() => {
    if (selectedPins && selectedPins.length > 0) {
      setExportScope('selected');
    }
  }, [selectedPins?.length]);

  const activePins = useMemo(() => {
    if (exportScope === 'selected' && selectedPins && selectedPins.length > 0) {
      return selectedPins;
    }
    return pins;
  }, [exportScope, selectedPins, pins]);

  // Bulk Scheduling Configuration State
  const [scheduleConfig, setScheduleConfig] = useState<BulkScheduleConfig>(getDefaultBulkScheduleConfig());
  const [showScheduleSettings, setShowScheduleSettings] = useState(true);

  // Bulk Schedule Preview
  const schedulePreview: BulkSchedulePreview = useMemo(() => {
    return calculateBulkSchedulePreview(activePins, scheduleConfig);
  }, [activePins, scheduleConfig]);

  // Validate current pins for export
  const validation: BatchExportValidation = useMemo(() => {
    return validatePinsForExport(activePins, boards);
  }, [activePins, boards]);

  const hasPins = activePins.length > 0;
  const isAllValid = validation.invalidCount === 0 && hasPins;
  const hasIssues = validation.invalidCount > 0;

  // Instant 1-Click CSV Download (no cloud upload wait)
  const handleInstantDownload = () => {
    if (!hasPins) return;
    const filename = exportScope === 'selected' 
      ? `pinterest-selected-${activePins.length}-pins.csv`
      : 'pinterest-bulk-upload.csv';
    downloadPinterestCSV(activePins, boards, filename, {
      timeFormat: scheduleConfig.timeFormat || '12h'
    });
  };

  const executeDownload = async () => {
    if (!hasPins) return;
    setIsExporting(true);
    setExportSuccessMsg(null);
    setFailedUploads([]);
    setUploadStatusText('Applying bulk schedule and preparing images...');

    try {
      // 1. Detect and Auto-Fix duplicate titles before export
      let pinsForExport = activePins;
      const dupScan = detectDuplicateTitles(pinsForExport);
      if (dupScan.hasDuplicates) {
        setUploadStatusText(`Auto-rewriting ${dupScan.duplicatesCount} duplicate Pin titles to unique SEO titles...`);
        const autoFixResult = await autoFixDuplicateTitles(pinsForExport);
        pinsForExport = autoFixResult.updatedPins;
        if (onPinsUpdated && autoFixResult.changes.length > 0) {
          onPinsUpdated(pinsForExport);
        }
      }

      // 2. Apply schedule to pins
      const { updatedPins: scheduledPins } = applyScheduleToPins(pinsForExport, scheduleConfig);

      // 3. Upload images and resolve real public HTTPS URLs
      const result: PreparePinsResult = await preparePinsForExportWithMediaUrls(
        scheduledPins,
        (current, total) => {
          setUploadStatusText(`Uploading images... ${current} / ${total}`);
        }
      );

      // Save updated URLs to app state
      if (onPinsUpdated && result.updatedPins.length > 0) {
        onPinsUpdated(result.updatedPins);
      }

      // Check if any failed
      if (!result.success || result.failedPins.length > 0) {
        setFailedUploads(result.failedPins);
        setIsExporting(false);
        setUploadStatusText('');
        return;
      }

      // 4. Generate CSV
      setUploadStatusText('Generating CSV...');
      await new Promise(r => setTimeout(r, 150));

      const filename = exportScope === 'selected' 
        ? `pinterest-selected-${activePins.length}-pins.csv`
        : 'pinterest-bulk-upload.csv';

      downloadPinterestCSV(result.updatedPins, boards, filename, {
        timeFormat: scheduleConfig.timeFormat || '12h'
      });

      setExportSuccessMsg({
        text: filename,
        totalPins: result.updatedPins.length,
        uploadedCount: result.uploadedCount,
        existingCount: result.existingCount,
        scheduledCount: scheduleConfig.enabled ? schedulePreview.assignedCount : 0,
      });
      setShowValidationModal(false);
    } catch (err: any) {
      console.error('[Bulk Export Section] Error during export:', err);
      setFailedUploads([
        {
          pin: activePins[0],
          pinNumber: 1,
          title: activePins[0]?.title || 'Export',
          error: err.message || 'Image storage failure',
        },
      ]);
    } finally {
      setIsExporting(false);
      setUploadStatusText('');
    }
  };

  const handleExportClick = () => {
    if (!hasPins) return;

    if (hasIssues) {
      // Prompt user with validation dialog showing missing fields
      setShowValidationModal(true);
    } else {
      executeDownload();
    }
  };

  return (
    <div className={`bg-white dark:bg-black/80 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-6 shadow-xs transition-colors space-y-5 ${className}`}>
      {/* Section Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.08] text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Bulk Export Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bulk scheduling, public image URL generation & official 8-column Pinterest format
              </p>
            </div>
          </div>
        </div>

        {/* Total Badge */}
        <div className="text-right">
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]">
            {activePins.length} {activePins.length === 1 ? 'Pin' : 'Pins'}
          </span>
        </div>
      </div>

      {/* Scope Selector: Selected vs All */}
      {selectedPins && selectedPins.length > 0 && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => setExportScope('selected')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              exportScope === 'selected'
                ? 'bg-white dark:bg-black text-[#E60023] shadow-xs border border-slate-200/60 dark:border-white/[0.12]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${exportScope === 'selected' ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span>Selected Images Only ({selectedPins.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setExportScope('all')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              exportScope === 'all'
                ? 'bg-white dark:bg-black text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-white/[0.12]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>All Library Images ({pins.length})</span>
          </button>
        </div>
      )}

      {/* Duplicate Title Detection & Auto-Fix Banner */}
      {hasPins && (
        <DuplicateTitleBanner
          pins={activePins}
          onPinsUpdated={(updated) => {
            if (onPinsUpdated) onPinsUpdated(updated);
          }}
        />
      )}

      {/* Bulk Scheduling Settings Accordion/Panel */}
      {hasPins && (
        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
          <BulkScheduleSettings
            pins={activePins}
            boards={boards}
            config={scheduleConfig}
            onChange={setScheduleConfig}
            preview={schedulePreview}
          />
        </div>
      )}

      {/* Export Action Button */}
      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
        {hasPins ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleInstantDownload}
              disabled={isExporting}
              className="sm:w-auto bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 font-bold text-xs py-3.5 px-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
              title="Instantly download CSV now using current image URLs without uploading to cloud"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Instant CSV ({activePins.length})</span>
            </button>
            <button
              type="button"
              onClick={handleExportClick}
              disabled={isExporting || (scheduleConfig.enabled && !schedulePreview.isValid)}
              className="flex-1 bg-[#E60023] hover:bg-[#ad001a] active:bg-[#8f0015] disabled:opacity-50 text-white font-bold text-xs py-3.5 px-5 rounded-2xl shadow-md shadow-red-200/50 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.008] active:scale-[0.99]"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{uploadStatusText || `Exporting ${activePins.length} Pins...`}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {exportScope === 'selected'
                      ? `Export ${activePins.length} Selected Pin${activePins.length > 1 ? 's' : ''} to CSV`
                      : `Export All ${pins.length} Pins to CSV`}
                  </span>
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled
            className="w-full bg-slate-100 dark:bg-white/[0.03] text-slate-400 dark:text-slate-500 font-bold text-xs py-3.5 px-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>No Pins available to export</span>
          </button>
        )}

        {/* Live Validation & Status Badges */}
        {hasPins && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="font-mono">{activePins.length}</span> {exportScope === 'selected' ? 'Selected' : ''} Pins ready
              </div>

              <div className="flex items-center gap-3">
                {isAllValid ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✓ Valid</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowProblemDetails(prev => !prev)}
                    className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-bold hover:underline cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>⚠ {validation.invalidCount} {validation.invalidCount === 1 ? 'Pin has' : 'Pins have'} missing information</span>
                    {showProblemDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>

            {/* Problem Details Inspector Drawer */}
            {showProblemDetails && hasIssues && (
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-2 text-xs animate-in fade-in">
                <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Problematic Pins before export:</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-amber-100 dark:divide-white/[0.06]">
                  {validation.problematicPins.map((prob) => (
                    <div key={prob.pinId} className="pt-1.5 first:pt-0">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        Pin #{prob.pinNumber} <span className="font-normal text-slate-500 dark:text-slate-400">({prob.title})</span>
                      </div>
                      <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                        Missing: <span className="font-bold">{prob.missingFields.join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Failed Uploads Alert */}
        {failedUploads.length > 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/80 rounded-2xl space-y-3 text-xs animate-in fade-in">
            <div className="flex items-start gap-2.5 text-red-900 dark:text-red-200 font-bold">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span>Export could not be completed.</span>
                <p className="font-normal text-[11px] text-red-700 dark:text-red-300 pt-0.5">
                  {failedUploads.length} images could not be uploaded:
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-black/60 p-2.5 rounded-xl border border-red-100 dark:border-white/[0.08] max-h-32 overflow-y-auto space-y-1">
              {failedUploads.map((fail) => (
                <div key={fail.pin.id} className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 flex justify-between">
                  <span>Pin #{fail.pinNumber} — {fail.title}</span>
                  <span className="text-red-500 font-mono">{fail.error}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Please fix these images and try again.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={executeDownload}
                className="flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
                <span>Retry Upload</span>
              </button>
              <button
                type="button"
                onClick={() => setFailedUploads([])}
                className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.1] cursor-pointer"
              >
                Cancel Export
              </button>
            </div>
          </div>
        )}

        {/* Success Confirmation Card */}
        {exportSuccessMsg && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold block text-emerald-950 dark:text-emerald-100">✓ Export completed</span>
                  <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300">{exportSuccessMsg.text}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExportSuccessMsg(null)}
                className="text-emerald-600 hover:text-emerald-900 dark:hover:text-white text-xs font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-1 flex items-center gap-2 font-mono">
              <span>{exportSuccessMsg.totalPins} Pins exported</span>
              <span>•</span>
              <span>{exportSuccessMsg.totalPins} public URLs generated</span>
              {exportSuccessMsg.scheduledCount > 0 && (
                <>
                  <span>•</span>
                  <span>{exportSuccessMsg.scheduledCount} slots scheduled</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Import CSV Secondary Action */}
        {onOpenImportCsv && (
          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Have an existing Pinterest CSV?
            </span>
            <button
              type="button"
              onClick={onOpenImportCsv}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.08] px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Import CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Validation Dialog: Export Anyway or Cancel */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white/95 dark:bg-black/95 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Missing Pin Information
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {validation.invalidCount} of {pins.length} Pins have missing required fields for Pinterest.
                </p>
              </div>
            </div>

            {/* List of Problematic Pins */}
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-3.5 max-h-56 overflow-y-auto space-y-2 text-xs">
              {validation.problematicPins.map((prob) => (
                <div key={prob.pinId} className="bg-white dark:bg-black/60 p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                    <span>Pin #{prob.pinNumber}</span>
                    <span className="text-[11px] font-normal text-slate-400 truncate max-w-[200px]">{prob.title}</span>
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    Missing: <span className="font-bold">{prob.missingFields.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-blue-50/60 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
                Exporting will auto-upload images to public URLs and export missing fields as empty values. You can also cancel and fill in missing fields first.
              </span>
            </div>

            {/* Actions: Export Anyway or Cancel */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDownload}
                className="px-5 py-2.5 rounded-xl bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold cursor-pointer transition-all shadow-md shadow-red-200/50"
              >
                Export Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
