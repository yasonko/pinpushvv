import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Check, 
  UploadCloud, 
  Info,
  Layers,
  ArrowRight,
  RotateCw,
  Globe,
  Sparkles,
  ExternalLink,
  Play,
  Calendar,
  Clock,
  Eye,
  Wand2,
  CheckSquare
} from 'lucide-react';
import { Pin, Board } from '../../types';
import { 
  validatePinsForExport, 
  downloadPinterestCSV, 
  BatchExportValidation,
  PINTEREST_CSV_COLUMNS,
  isPublicHttpsUrl
} from '../../services/csvEngine';
import { 
  preparePinsForExportWithMediaUrls, 
  PreparePinsResult,
  testSingleImageUpload,
  SingleUploadTestResult
} from '../../services/imageStorageService';
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

interface BulkExportModalProps {
  pins: Pin[];
  targetPins?: Pin[] | null;
  boards: Board[];
  isOpen: boolean;
  onClose: () => void;
  onOpenImportCsv?: () => void;
  onPinsUpdated?: (updatedPins: Pin[]) => void;
}

type ExportStep = 'idle' | 'testing' | 'preparing' | 'uploading' | 'generating' | 'completed' | 'failed';

export const BulkExportModal: React.FC<BulkExportModalProps> = ({
  pins,
  targetPins,
  boards,
  isOpen,
  onClose,
  onOpenImportCsv,
  onPinsUpdated,
}) => {
  const [currentStep, setCurrentStep] = useState<ExportStep>('idle');
  const [filterProblematicOnly, setFilterProblematicOnly] = useState(false);
  const [testResult, setTestResult] = useState<SingleUploadTestResult | null>(null);
  const [isTestingSingle, setIsTestingSingle] = useState(false);

  // Export Scope: 'selected' (if targetPins provided) vs 'all'
  const [exportScope, setExportScope] = useState<'selected' | 'all'>(
    targetPins && targetPins.length > 0 ? 'selected' : 'all'
  );

  // Bulk Scheduling Configuration State
  const [scheduleConfig, setScheduleConfig] = useState<BulkScheduleConfig>(getDefaultBulkScheduleConfig());

  // Determine active pins based on scope
  const activePins = useMemo(() => {
    if (exportScope === 'selected' && targetPins && targetPins.length > 0) {
      return targetPins;
    }
    return pins;
  }, [exportScope, targetPins, pins]);

  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentTitle: string }>({
    current: 0,
    total: activePins.length,
    currentTitle: '',
  });

  const [exportSummary, setExportSummary] = useState<{
    totalPins: number;
    uploadedCount: number;
    existingCount: number;
    filename: string;
    scheduledCount: number;
  } | null>(null);

  const [failedUploads, setFailedUploads] = useState<Array<{
    pin: Pin;
    pinNumber: number;
    title: string;
    error: string;
  }>>([]);

  const [schedulingError, setSchedulingError] = useState<string | null>(null);

  // Re-synchronize when modal opens or targetPins change
  useEffect(() => {
    if (isOpen) {
      setExportScope(targetPins && targetPins.length > 0 ? 'selected' : 'all');
      setCurrentStep('idle');
      setTestResult(null);
      setSchedulingError(null);
      setFailedUploads([]);
      setExportSummary(null);
    }
  }, [isOpen, targetPins]);

  // Bulk Schedule Preview based on activePins
  const schedulePreview: BulkSchedulePreview = useMemo(() => {
    return calculateBulkSchedulePreview(activePins, scheduleConfig);
  }, [activePins, scheduleConfig]);

  const validation: BatchExportValidation = useMemo(() => {
    return validatePinsForExport(activePins, boards);
  }, [activePins, boards]);

  const hasPins = activePins.length > 0;
  const isAllValid = validation.invalidCount === 0 && hasPins;
  const hasIssues = validation.invalidCount > 0;

  // Single Image Test Upload Action
  const handleTestSingleUpload = async () => {
    if (!hasPins) return;
    const testPin = activePins.find(p => p.imageUrl || p.thumbnailUrl) || activePins[0];
    if (!testPin) return;

    setIsTestingSingle(true);
    setTestResult(null);

    try {
      const result = await testSingleImageUpload(testPin);
      setTestResult(result);
      if (result.success && result.publicUrl && onPinsUpdated) {
        onPinsUpdated([{ ...testPin, mediaUrl: result.publicUrl }]);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        pinId: testPin.id,
        title: testPin.title || testPin.filename || 'Pin #1',
        verified: false,
        error: err.message || 'Single upload test failed',
      });
    } finally {
      setIsTestingSingle(false);
    }
  };

  // Instant 1-Click CSV Download (no cloud upload wait)
  const handleInstantCsvDownload = () => {
    if (!hasPins) return;
    const filename = exportScope === 'selected' 
      ? `pinterest-selected-${activePins.length}-pins.csv`
      : 'pinterest-bulk-upload.csv';
    downloadPinterestCSV(activePins, boards, filename, {
      timeFormat: scheduleConfig.timeFormat || '12h'
    });
  };

  // Main Export Workflow with Bulk Scheduling + Automatic Public Image URL Resolution
  const startExportWorkflow = async () => {
    if (!hasPins) return;

    // Validate Scheduling settings if enabled
    if (scheduleConfig.enabled) {
      if (!schedulePreview.isValid) {
        setSchedulingError(
          schedulePreview.errorMessage || 'Scheduling error: Please check your start/end dates and time slots.'
        );
        return;
      }
    }
    setSchedulingError(null);

    setCurrentStep('preparing');
    setFailedUploads([]);
    setExportSummary(null);

    try {
      // Step 1: Detect and Auto-Fix Duplicate Titles before export
      let pinsForExport = activePins;
      const dupScan = detectDuplicateTitles(pinsForExport);
      if (dupScan.hasDuplicates) {
        const autoFixResult = await autoFixDuplicateTitles(pinsForExport);
        pinsForExport = autoFixResult.updatedPins;
        if (onPinsUpdated && autoFixResult.changes.length > 0) {
          onPinsUpdated(pinsForExport);
        }
      }

      // Step 2: Apply Bulk Schedule to Pins
      const { updatedPins: scheduledPins } = applyScheduleToPins(pinsForExport, scheduleConfig);

      // Step 3: Upload missing images with live progress
      setCurrentStep('uploading');

      const result: PreparePinsResult = await preparePinsForExportWithMediaUrls(
        scheduledPins,
        (current, total, pin) => {
          setUploadProgress({
            current,
            total,
            currentTitle: pin.title || pin.filename || `Pin #${current}`,
          });
        }
      );

      // Notify parent app of any newly scheduled pins and persisted media URLs
      if (onPinsUpdated && result.updatedPins.length > 0) {
        onPinsUpdated(result.updatedPins);
      }

      // Check if any uploads failed
      if (!result.success || result.failedPins.length > 0) {
        setFailedUploads(result.failedPins);
        setCurrentStep('failed');
        return;
      }

      // Step 4: Generating CSV
      setCurrentStep('generating');
      await new Promise((r) => setTimeout(r, 200));

      const filename = exportScope === 'selected' 
        ? `pinterest-selected-${activePins.length}-pins.csv`
        : 'pinterest-bulk-upload.csv';

      downloadPinterestCSV(result.updatedPins, boards, filename, {
        timeFormat: scheduleConfig.timeFormat || '12h'
      });

      // Step 5: Export completed summary
      setExportSummary({
        totalPins: result.updatedPins.length,
        uploadedCount: result.uploadedCount,
        existingCount: result.existingCount,
        filename,
        scheduledCount: scheduleConfig.enabled ? schedulePreview.assignedCount : 0,
      });
      setCurrentStep('completed');
    } catch (err: any) {
      console.error('[Bulk Export] Error during export workflow:', err);
      setFailedUploads([
        {
          pin: activePins[0],
          pinNumber: 1,
          title: activePins[0]?.title || 'Export Process',
          error: err.message || 'Unexpected failure during export preparation',
        },
      ]);
      setCurrentStep('failed');
    }
  };

  const displayedList = filterProblematicOnly 
    ? validation.problematicPins 
    : validation.allValidations;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white/95 dark:bg-black/90 dark:backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-white/[0.08] w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.08] text-[#E60023] flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {exportScope === 'selected' 
                    ? `Export Selected Images (${activePins.length})` 
                    : 'Bulk Export to CSV'}
                </h2>
                {exportScope === 'selected' && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Selected Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {exportScope === 'selected'
                  ? `Exporting only the ${activePins.length} selected image${activePins.length > 1 ? 's' : ''} to official Pinterest CSV`
                  : 'Bulk scheduling, public image URL generation & official 8-column Pinterest format'}
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

        {/* Modal Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto bg-white/95 dark:bg-black/90">
          
          {/* Scope Selector: Selected Images Only vs All Library Images */}
          {targetPins && targetPins.length > 0 && currentStep === 'idle' && (
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setExportScope('selected')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  exportScope === 'selected'
                    ? 'bg-white dark:bg-black text-[#E60023] shadow-xs border border-slate-200/60 dark:border-white/[0.12]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${exportScope === 'selected' ? 'text-emerald-500' : 'text-slate-400'}`} />
                <span>Selected Images Only ({targetPins.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
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
          
          {/* TEST 1 IMAGE CARD */}
          {hasPins && currentStep === 'idle' && (
            <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
                    <span>Test Image Storage First</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Verify that your generated images upload successfully and receive a verified public HTTPS URL.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestSingleUpload}
                  disabled={isTestingSingle}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-transparent dark:border-white/[0.08] text-slate-900 dark:text-white cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                >
                  {isTestingSingle ? (
                    <>
                      <div className="w-3 h-3 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                      <span>Testing Upload...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-[#E60023]" />
                      <span>[ Test Image Upload ]</span>
                    </>
                  )}
                </button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs space-y-1.5 animate-in fade-in duration-150 ${
                  testResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/80 text-red-900 dark:text-red-200'
                }`}>
                  <div className="font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>✓ Image uploaded successfully</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span>Upload test failed</span>
                        </>
                      )}
                    </span>

                    {testResult.verified && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md font-bold">
                        URL verified: ✓
                      </span>
                    )}
                  </div>

                  {testResult.publicUrl && (
                    <div className="text-[11px] font-mono break-all pt-1 flex items-center justify-between gap-2">
                      <span className="truncate">Public URL: <span className="underline">{testResult.publicUrl}</span></span>
                      <a 
                        href={testResult.publicUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                      >
                        <span>Open URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {testResult.error && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 font-mono">
                      Error: {testResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP: UPLOADING / PREPARING / GENERATING PROGRESS */}
          {(currentStep === 'preparing' || currentStep === 'uploading' || currentStep === 'generating') && (
            <div className="p-6 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-white/[0.04] border border-transparent dark:border-white/[0.08] text-[#E60023] flex items-center justify-center mx-auto animate-pulse">
                <UploadCloud className="w-6 h-6 animate-bounce" />
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Preparing Pinterest Bulk Export...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentStep === 'uploading' && (
                    <span>Uploading images and assigning 12-hour scheduling slots...</span>
                  )}
                  {currentStep === 'generating' && (
                    <span>Generating RFC 4180 CSV with public media URLs and scheduled dates...</span>
                  )}
                  {currentStep === 'preparing' && (
                    <span>Verifying image URLs and scheduling integrity...</span>
                  )}
                </p>
              </div>

              {/* Progress Counter & Bar */}
              {currentStep === 'uploading' && (
                <div className="space-y-2 max-w-md mx-auto pt-2">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    <span>Uploading images...</span>
                    <span>{uploadProgress.current} / {uploadProgress.total}</span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#E60023] rounded-full transition-all duration-200"
                      style={{ 
                        width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` 
                      }}
                    />
                  </div>

                  {uploadProgress.currentTitle && (
                    <p className="text-[11px] text-slate-400 truncate">
                      Processing: <span className="font-semibold text-slate-600 dark:text-slate-300">{uploadProgress.currentTitle}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP: COMPLETED SUMMARY */}
          {currentStep === 'completed' && exportSummary && (
            <div className="p-6 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-3xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-emerald-950 dark:text-emerald-200">
                    ✓ Export completed
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    Your Pinterest Bulk Upload CSV is downloaded with scheduled dates and ready for Pinterest.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2">
                <div className="p-3 bg-white dark:bg-black/60 rounded-2xl border border-emerald-200/60 dark:border-white/[0.08] text-center">
                  <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {exportSummary.totalPins}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Pins exported
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-black/60 rounded-2xl border border-emerald-200/60 dark:border-white/[0.08] text-center">
                  <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {exportSummary.uploadedCount}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    images uploaded
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-black/60 rounded-2xl border border-emerald-200/60 dark:border-white/[0.08] text-center">
                  <div className="text-base font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                    {exportSummary.totalPins}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    URLs verified
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-black/60 rounded-2xl border border-emerald-200/60 dark:border-white/[0.08] text-center">
                  <div className="text-base font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                    {exportSummary.scheduledCount}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    slots scheduled
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-white dark:bg-black/60 rounded-2xl border border-emerald-200/60 dark:border-white/[0.08] text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#E60023]" />
                  <span>{exportSummary.filename}</span>
                </span>
                <button
                  type="button"
                  onClick={() => downloadPinterestCSV(activePins, boards, exportSummary.filename)}
                  className="text-xs font-bold text-[#E60023] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download again</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP: FAILED UPLOADS ERROR VIEW */}
          {currentStep === 'failed' && (
            <div className="p-6 bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-800/80 rounded-3xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-red-950 dark:text-red-200">
                    Export could not be completed
                  </h3>
                  <p className="text-xs text-red-800 dark:text-red-300">
                    {failedUploads.length} {failedUploads.length === 1 ? 'image' : 'images'} could not be uploaded:
                  </p>
                </div>
              </div>

              <div className="border border-red-200 dark:border-white/[0.08] rounded-2xl bg-white dark:bg-black/60 divide-y divide-red-100 dark:divide-white/[0.06] overflow-hidden max-h-48 overflow-y-auto">
                {failedUploads.map((fail) => (
                  <div key={fail.pin.id} className="p-3 text-xs flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      <span className="font-mono text-red-500 font-bold mr-1.5">Pin #{fail.pinNumber}</span>
                      <span>— {fail.title}</span>
                    </div>
                    <span className="text-[11px] text-red-600 dark:text-red-400 font-mono shrink-0">
                      {fail.error}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Please fix these images and try again. Local paths are never placed into the CSV as a fallback.
              </p>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={startExportWorkflow}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Retry Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('idle')}
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] px-4 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.1] transition-colors"
                >
                  Cancel Export
                </button>
              </div>
            </div>
          )}

          {/* BULK SCHEDULING SECTION (INTEGRATED INTO EXPORT SETTINGS) */}
          {hasPins && currentStep === 'idle' && (
            <div className="space-y-3">
              <BulkScheduleSettings
                pins={activePins}
                boards={boards}
                config={scheduleConfig}
                onChange={setScheduleConfig}
                preview={schedulePreview}
              />

              {schedulingError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{schedulingError}</span>
                </div>
              )}
            </div>
          )}

          {/* Official Format Specs Card */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>Pinterest Standard Column Layout (8 Columns):</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400">UTF-8 + BOM</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PINTEREST_CSV_COLUMNS.map((col, idx) => (
                <span 
                  key={col}
                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg border ${
                    col === 'Publish date' && scheduleConfig.enabled
                      ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold'
                      : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="text-slate-400 mr-1">{idx + 1}.</span>
                  {col}
                  {col === 'Publish date' && scheduleConfig.enabled && (
                    <span className="ml-1 text-[10px] text-purple-500 font-extrabold">● Active</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Duplicate Title Detection & Auto-Fix Banner */}
          {hasPins && currentStep === 'idle' && (
            <DuplicateTitleBanner
              pins={activePins}
              onPinsUpdated={(updated) => {
                if (onPinsUpdated) onPinsUpdated(updated);
              }}
            />
          )}

          {/* Validation Status Bar */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] rounded-2xl">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{activePins.length} {exportScope === 'selected' ? 'Selected' : 'Total'} Pins Ready</span>
                {isAllValid ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>✓ Valid</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>⚠ {validation.invalidCount} Pins with missing info</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                All local images will be auto-uploaded to public HTTPS URLs before CSV creation.
              </p>
            </div>

            {hasIssues && (
              <button
                type="button"
                onClick={() => setFilterProblematicOnly(prev => !prev)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                  filterProblematicOnly 
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800' 
                    : 'bg-white dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.1]'
                }`}
              >
                {filterProblematicOnly ? 'Showing Problematic Pins' : 'Filter Problematic'}
              </button>
            )}
          </div>

          {/* Pin Validation Inspector List */}
          {hasPins ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Dataset Pin Preview ({displayedList.length} of {activePins.length} shown)</span>
                <span className="text-[11px] text-slate-400">Every pin will export as exactly one row</span>
              </div>

              <div className="border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
                {displayedList.map((item) => {
                  const scheduleAssignment = schedulePreview.assignments[item.pinNumber - 1];
                  return (
                    <div 
                      key={item.pinId}
                      className={`p-3 flex items-center justify-between gap-3 text-xs ${
                        item.isValid ? 'hover:bg-slate-50 dark:hover:bg-white/[0.04]' : 'bg-amber-50/50 dark:bg-amber-950/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-[11px] text-slate-400 w-8">#{item.pinNumber}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {item.title}
                          </div>
                          {item.missingFields.length > 0 && (
                            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                              Missing: {item.missingFields.join(', ')}
                            </div>
                          )}
                          {scheduleConfig.enabled && scheduleAssignment?.slot && (
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-mono font-semibold flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>
                                {scheduleConfig.timeFormat === '12h_us'
                                  ? scheduleAssignment.slot.formattedCsv12hUs
                                  : scheduleConfig.timeFormat === '24h'
                                  ? scheduleAssignment.slot.formattedCsv24h
                                  : scheduleAssignment.slot.formattedCsv12h}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.hasPublicMediaUrl ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900 font-semibold">
                            <Globe className="w-3 h-3" />
                            <span>HTTPS Ready</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-md">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Auto-Upload</span>
                          </span>
                        )}

                        {item.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Ready</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Incomplete</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08] space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No Pins available to export
              </div>
              <p className="text-[11px] text-slate-400">
                Upload or import some pins first to generate a Pinterest bulk upload CSV.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between">
          <div>
            {onOpenImportCsv && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImportCsv();
                }}
                className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Import CSV Instead</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] px-4 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.1] transition-colors"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleInstantCsvDownload}
              disabled={!hasPins || currentStep === 'preparing' || currentStep === 'uploading' || currentStep === 'generating'}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white hover:bg-slate-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.08] px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-40"
              title="Instantly download CSV now with current image URLs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Instant CSV ({activePins.length})</span>
            </button>

            <button
              type="button"
              onClick={startExportWorkflow}
              disabled={!hasPins || currentStep === 'preparing' || currentStep === 'uploading' || currentStep === 'generating' || (scheduleConfig.enabled && !schedulePreview.isValid)}
              className="flex items-center gap-2 text-xs font-bold text-white bg-[#E60023] hover:bg-[#ad001a] disabled:opacity-40 px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200/50 dark:shadow-none"
            >
              {currentStep === 'uploading' || currentStep === 'preparing' || currentStep === 'generating' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing Images & CSV...</span>
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
        </div>
      </div>
    </div>
  );
};
