import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  EbookBatch, 
  EbookGroup, 
  EbookImageItem, 
  EbookProgressState, 
  PdfSettings 
} from '../../types/ebook';
import { Board, Website, Pin } from '../../types';
import { EbookSettingsPanel } from './EbookSettingsPanel';
import { EbookImageGrid } from './EbookImageGrid';
import { EbookGroupAccordion } from './EbookGroupAccordion';
import { EbookResultsDashboard } from './EbookResultsDashboard';
import { 
  sortImagesNaturally, 
  deriveTitleFromFilename, 
  reindexImageSequences 
} from '../../services/ebook/imageSorter';
import { 
  groupImagesDeterministically, 
  executeEbookBatch,
  retryFailedUploadsOnly
} from '../../services/ebook/ebookBatchEngine';
import { 
  computeBatchHash, 
  saveEbookBatch, 
  getLastEbookBatch, 
  clearActiveEbookBatch,
  findBatchByHash
} from '../../services/ebook/ebookBatchStorage';
import { 
  BookOpen, 
  UploadCloud, 
  Layers, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  FileText, 
  FolderArchive, 
  ArrowRight, 
  Check, 
  AlertCircle,
  PlusCircle,
  Library,
  Settings2,
  FolderOpen,
  RotateCw,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { extractPagesFromPdf } from '../../services/pdfImportService';
import { DirectPdfUploader } from '../Upload/DirectPdfUploader';

interface EbookBuilderViewProps {
  pins: Pin[];
  boards: Board[];
  websites: Website[];
  defaultBoardId?: string;
  defaultWebsiteId?: string;
  onExportToPins?: (newPins: Partial<Pin>[]) => void;
  onOpenPinLibrary?: () => void;
}

const DEFAULT_PDF_SETTINGS: PdfSettings = {
  imagesPerPdf: 20,
  pageSize: 'A4',
  orientation: 'portrait',
  imageFit: 'contain',
  quality: 'standard',
  margins: 'small',
  pageNumbers: true,
  pageNumberPosition: 'bottom-center',
  generateCover: true,
  addCoverAsFirstPage: true,
  generateBackCover: false,
  coverTheme: 'modern',
  authorName: '',
  namingPrefix: 'Digital_Ebook',
  startNumber: 1,
  pdfFolderInZip: false,
  pinterestIntegration: true,
  defaultBoardId: '',
  defaultWebsiteId: '',
};

export const EbookBuilderView: React.FC<EbookBuilderViewProps> = ({
  pins,
  boards,
  websites,
  defaultBoardId,
  defaultWebsiteId,
  onExportToPins,
  onOpenPinLibrary,
}) => {
  // Navigation steps: 'upload' | 'grouping' | 'processing' | 'results'
  const [currentStep, setCurrentStep] = useState<'upload' | 'grouping' | 'processing' | 'results'>('upload');

  const [images, setImages] = useState<EbookImageItem[]>([]);
  const [settings, setSettings] = useState<PdfSettings>(() => ({
    ...DEFAULT_PDF_SETTINGS,
    defaultBoardId: defaultBoardId || '',
    defaultWebsiteId: defaultWebsiteId || '',
  }));

  const [activeBatch, setActiveBatch] = useState<EbookBatch | null>(null);
  const [isDirectPdfModalOpen, setIsDirectPdfModalOpen] = useState(false);
  const [progressState, setProgressState] = useState<EbookProgressState>({
    currentStage: 'idle',
    currentGroupIndex: 0,
    totalGroups: 0,
    currentImageIndex: 0,
    totalImages: 0,
    percentage: 0,
    detailMessage: '',
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [resumePromptBatch, setResumePromptBatch] = useState<EbookBatch | null>(null);
  const [isImportLibraryModalOpen, setIsImportLibraryModalOpen] = useState<boolean>(false);
  const [selectedLibraryPinIds, setSelectedLibraryPinIds] = useState<Set<string>>(new Set());

  const abortControllerRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const [pdfImportProgress, setPdfImportProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // Sync default board/website if settings are empty
  useEffect(() => {
    if (defaultBoardId && !settings.defaultBoardId) {
      setSettings((prev) => ({ ...prev, defaultBoardId }));
    }
    if (defaultWebsiteId && !settings.defaultWebsiteId) {
      setSettings((prev) => ({ ...prev, defaultWebsiteId }));
    }
  }, [defaultBoardId, defaultWebsiteId]);

  // Check for previous incomplete/resumable batch on mount
  useEffect(() => {
    getLastEbookBatch().then((saved) => {
      if (saved && (saved.status === 'processing' || saved.status === 'paused' || (saved.status === 'completed' && saved.groups.length > 0))) {
        setResumePromptBatch(saved);
      }
    });
  }, []);

  // Update Settings Partial
  const handleSettingsChange = useCallback((updated: Partial<PdfSettings>) => {
    setSettings((prev) => ({ ...prev, ...updated }));
  }, []);

  // File Upload Handlers (Images & PDF documents with natural sorting)
  const processUploadedFiles = useCallback(async (files: FileList | File[]) => {
    const rawFiles = Array.from(files);
    if (rawFiles.length === 0) return;

    const newItems: EbookImageItem[] = [];

    for (let fIdx = 0; fIdx < rawFiles.length; fIdx++) {
      const file = rawFiles[fIdx];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        try {
          const extractedPages = await extractPagesFromPdf(file, {
            scale: 1.5,
            quality: 0.88,
            onProgress: (current, total, message) => {
              setPdfImportProgress({ current, total, message: `PDF [${file.name}]: ${message}` });
            },
          });

          for (let pIdx = 0; pIdx < extractedPages.length; pIdx++) {
            const page = extractedPages[pIdx];
            newItems.push({
              id: `img_pdf_${Date.now()}_${pIdx}_${Math.random().toString(36).substr(2, 6)}`,
              file: page.file,
              filename: page.filename,
              originalIndex: images.length + newItems.length,
              sequenceNumber: images.length + newItems.length + 1,
              previewUrl: page.dataUrl,
              dataUrl: page.dataUrl,
              size: page.file.size,
              mimeType: 'image/jpeg',
              title: page.title,
            });
          }
        } catch (pdfErr) {
          console.error('Failed to extract pages from PDF in eBook builder:', file.name, pdfErr);
          alert(`Error reading PDF file: ${file.name}`);
        } finally {
          setPdfImportProgress(null);
        }
      } else if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: `img_${Date.now()}_${fIdx}_${Math.random().toString(36).substr(2, 6)}`,
          file,
          filename: file.name,
          originalIndex: images.length + newItems.length,
          sequenceNumber: images.length + newItems.length + 1,
          previewUrl,
          size: file.size,
          mimeType: file.type,
          title: deriveTitleFromFilename(file.name),
        });
      }
    }

    if (newItems.length === 0) return;

    setImages((prev) => {
      const combined = [...prev, ...newItems];
      return sortImagesNaturally(combined, 'asc');
    });
  }, [images.length]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processUploadedFiles(e.dataTransfer.files);
      }
    },
    [processUploadedFiles]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFiles(e.target.files);
    }
  };

  // Import Pins from existing Library
  const handleImportPinsFromLibrary = () => {
    const selectedPins = pins.filter((p) => selectedLibraryPinIds.has(p.id));
    if (selectedPins.length === 0) return;

    const newItems: EbookImageItem[] = selectedPins.map((p, idx) => ({
      id: `img_pin_${p.id}`,
      filename: p.filename || `pin_${idx + 1}.jpg`,
      originalIndex: images.length + idx,
      sequenceNumber: images.length + idx + 1,
      previewUrl: p.imageUrl || p.thumbnailUrl,
      dataUrl: p.imageUrl,
      size: 0,
      mimeType: 'image/jpeg',
      title: p.title,
      description: p.description,
      tags: p.tags,
      importedFromPinId: p.id,
    }));

    setImages((prev) => {
      const combined = [...prev, ...newItems];
      return sortImagesNaturally(combined, 'asc');
    });

    setIsImportLibraryModalOpen(false);
    setSelectedLibraryPinIds(new Set());
  };

  // Build / Preview Groups
  const previewGroups = React.useMemo(() => {
    if (images.length === 0) return [];
    return groupImagesDeterministically(images, settings);
  }, [images, settings]);

  // Start Generation
  const handleStartGeneration = async (forceRegenerate: boolean = false) => {
    if (images.length === 0) return;

    const hash = computeBatchHash(images, settings);
    let targetBatch: EbookBatch;

    if (activeBatch && activeBatch.hash === hash && !forceRegenerate) {
      targetBatch = activeBatch;
    } else {
      const groups = groupImagesDeterministically(images, settings);
      targetBatch = {
        id: `batch_${Date.now()}`,
        hash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'preparing',
        settings,
        images,
        groups,
        totalImages: images.length,
        totalPdfs: groups.length,
        completedPdfs: 0,
        failedPdfs: 0,
      };
    }

    setActiveBatch(targetBatch);
    setIsProcessing(true);
    setIsPaused(false);
    setCurrentStep('processing');
    abortControllerRef.current = false;

    try {
      const finishedBatch = await executeEbookBatch(
        targetBatch,
        boards,
        websites,
        {
          onProgress: (prog) => {
            setProgressState(prog);
          },
          onGroupCompleted: (completedGroup) => {
            setActiveBatch((prev) => {
              if (!prev) return prev;
              const updatedGroups = prev.groups.map((g) =>
                g.id === completedGroup.id ? completedGroup : g
              );
              return {
                ...prev,
                groups: updatedGroups,
                completedPdfs: updatedGroups.filter((g) => g.status === 'completed').length,
              };
            });
          },
        },
        forceRegenerate,
        () => abortControllerRef.current
      );

      setActiveBatch(finishedBatch);
      setIsProcessing(false);
      if (finishedBatch.status === 'completed') {
        setCurrentStep('results');
      }
    } catch (err: any) {
      console.error('[Bulk Ebook] Fatal processing error:', err);
      setIsProcessing(false);
    }
  };

  const handlePauseGeneration = () => {
    abortControllerRef.current = true;
    setIsPaused(true);
    setIsProcessing(false);
  };

  const handleResumeSavedBatch = (batchToResume: EbookBatch) => {
    setActiveBatch(batchToResume);
    setImages(batchToResume.images);
    setSettings(batchToResume.settings);
    setResumePromptBatch(null);

    if (batchToResume.status === 'completed') {
      setCurrentStep('results');
    } else {
      setCurrentStep('processing');
    }
  };

  const handleStartFreshBatch = () => {
    clearActiveEbookBatch();
    setResumePromptBatch(null);
    setActiveBatch(null);
    setImages([]);
    setCurrentStep('upload');
  };

  const handleGroupUpdated = (updatedGroup: EbookGroup) => {
    setActiveBatch((prev) => {
      if (!prev) return prev;
      const nextGroups = prev.groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g));
      const nextBatch: EbookBatch = {
        ...prev,
        groups: nextGroups,
        completedPdfs: nextGroups.filter((g) => g.status === 'completed').length,
        uploadedPdfs: nextGroups.filter((g) => g.uploadStatus === 'completed').length,
        failedUploads: nextGroups.filter((g) => g.uploadStatus === 'upload_failed').length,
        updatedAt: new Date().toISOString(),
      };
      saveEbookBatch(nextBatch);
      return nextBatch;
    });
  };

  const handleRetryUploads = async () => {
    if (!activeBatch) return;
    setIsProcessing(true);
    setCurrentStep('processing');
    try {
      const finished = await retryFailedUploadsOnly(
        activeBatch,
        boards,
        websites,
        {
          onProgress: (prog) => setProgressState(prog),
          onGroupCompleted: (g) => handleGroupUpdated(g),
        }
      );
      setActiveBatch(finished);
      setCurrentStep('results');
    } catch (err) {
      console.error('Error retrying uploads:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-6 shadow-xs amoled-card transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm shadow-indigo-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Bulk eBook / PDF Builder</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 px-2.5 py-0.5 rounded-full">
                Module
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Transform image collections into styled PDF eBooks, generate AI metadata, and export ZIP + Excel spreadsheets.
            </p>
          </div>
        </div>

        {/* Step Navigation Pill Indicator */}
        <div className="flex items-center bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08] p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setCurrentStep('upload')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              currentStep === 'upload'
                ? 'bg-white dark:bg-white/[0.1] text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>1. Upload & Setup</span>
          </button>

          <button
            onClick={() => setCurrentStep('grouping')}
            disabled={images.length === 0}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              currentStep === 'grouping'
                ? 'bg-white dark:bg-white/[0.1] text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40'
            }`}
          >
            <span>2. Grouping ({previewGroups.length})</span>
          </button>

          <button
            onClick={() => setCurrentStep('processing')}
            disabled={!activeBatch && images.length === 0}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              currentStep === 'processing'
                ? 'bg-white dark:bg-white/[0.1] text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40'
            }`}
          >
            <span>3. Engine</span>
          </button>

          <button
            onClick={() => setCurrentStep('results')}
            disabled={!activeBatch || activeBatch.completedPdfs === 0}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              currentStep === 'results'
                ? 'bg-white dark:bg-white/[0.1] text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40'
            }`}
          >
            <span>4. Results</span>
          </button>
        </div>
      </div>

      {/* Resume Banner if previous session detected */}
      {resumePromptBatch && currentStep === 'upload' && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 amoled-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                Resumable Batch Found ({resumePromptBatch.totalPdfs} eBooks • {resumePromptBatch.totalImages} images)
              </div>
              <div className="text-xs text-indigo-700/80 dark:text-indigo-400 mt-0.5">
                {resumePromptBatch.completedPdfs} of {resumePromptBatch.totalPdfs} PDFs were generated. Would you like to resume from where you left off?
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResumeSavedBatch(resumePromptBatch)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
            >
              Resume Batch
            </button>
            <button
              onClick={handleStartFreshBatch}
              className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-rose-500 rounded-xl text-xs font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: UPLOAD & SETUP */}
      {currentStep === 'upload' && (
        <div className="space-y-6">
          {/* Dropzone & Import Actions */}
          <div
            data-dropzone="true"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-300 dark:border-white/[0.12] hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-8 text-center bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl transition-all cursor-pointer group amoled-card"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,.pdf,application/pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <input
              type="file"
              ref={pdfFileInputRef}
              multiple
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <div className="max-w-md mx-auto space-y-3 pointer-events-none">
              <div className="w-14 h-14 mx-auto bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                {pdfImportProgress ? (
                  <RotateCw className="w-7 h-7 animate-spin text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <UploadCloud className="w-7 h-7" />
                )}
              </div>

              {pdfImportProgress ? (
                <div className="space-y-2 py-1 pointer-events-auto">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <span>Extracting PDF Pages</span>
                    </span>
                    <span>
                      Page {pdfImportProgress.current} of {pdfImportProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(5, Math.round((pdfImportProgress.current / Math.max(1, pdfImportProgress.total)) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{pdfImportProgress.message}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Drag & Drop Images or PDF Files Here
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supports JPG, PNG, WEBP, and multi-page <strong className="text-indigo-600 dark:text-indigo-400">PDF documents</strong> (automatically split into pages). Filenames with numbers are automatically sorted!
                  </p>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Browse Images</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pdfFileInputRef.current?.click();
                  }}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800/60 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Import PDF Pages</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDirectPdfModalOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Just upload whole PDFs, get direct links and export spreadsheet without page image extraction"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Direct PDF Upload & Sheet</span>
                </button>

                {pins.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsImportLibraryModalOpen(true);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-white/[0.08]"
                  >
                    <Library className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>Import from Pins ({pins.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Configuration Settings Panel */}
          <EbookSettingsPanel
            settings={settings}
            onChange={handleSettingsChange}
            boards={boards}
            websites={websites}
            totalImages={images.length}
            sampleImage={images[0]}
          />

          {/* Image Grid with Sequence Badges & Natural Sorting */}
          {images.length > 0 && (
            <div className="space-y-4">
              <EbookImageGrid
                images={images}
                onImagesChange={setImages}
                imagesPerPdf={settings.imagesPerPdf}
              />

              {/* Bottom Action bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-sm amoled-card">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {images.length} Images Ready • {previewGroups.length} eBook PDFs
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Images are sorted naturally and mapped to {settings.imagesPerPdf} pages per PDF.
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentStep('grouping')}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-white/[0.08]"
                  >
                    <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span>Preview Grouping</span>
                  </button>

                  <button
                    onClick={() => handleStartGeneration(false)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Generate {previewGroups.length} eBooks (Bulk Engine)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: GROUPING PREVIEW */}
      {currentStep === 'grouping' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Deterministic Grouping Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review image assignments across all {previewGroups.length} PDF eBooks before rendering
              </p>
            </div>

            <button
              onClick={() => handleStartGeneration(false)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Bulk Generation</span>
            </button>
          </div>

          <EbookGroupAccordion
            groups={previewGroups}
            settings={settings}
            boards={boards}
            websites={websites}
          />
        </div>
      )}

      {/* STEP 3: PROCESSING ENGINE & LIVE PROGRESS */}
      {currentStep === 'processing' && (
        <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm space-y-6 amoled-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/[0.06] pb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl animate-pulse">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Bulk Processing Engine Active
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rendering PDFs in memory, generating AI SEO metadata, and packaging files safely
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isProcessing ? (
                <button
                  onClick={handlePauseGeneration}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause Engine</span>
                </button>
              ) : (
                <button
                  onClick={() => handleStartGeneration(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Resume Engine</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar & Details */}
          <div className="space-y-3 bg-slate-50/80 dark:bg-white/[0.03] p-5 rounded-2xl border border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-800 dark:text-slate-200">
                {progressState.detailMessage || 'Preparing batch generation...'}
              </span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                {progressState.percentage}%
              </span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-white/[0.08] rounded-full h-3 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out shadow-xs"
                style={{ width: `${progressState.percentage}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <div>
                PDF: <strong className="text-slate-900 dark:text-white">{progressState.currentGroupIndex}</strong> / {progressState.totalGroups}
              </div>
              <div>
                Images: <strong className="text-slate-900 dark:text-white">{progressState.currentImageIndex}</strong> / {progressState.totalImages}
              </div>
              <div>
                Completed PDFs: <strong className="text-emerald-600 dark:text-emerald-400">{activeBatch?.completedPdfs || 0}</strong>
              </div>
            </div>
          </div>

          {/* Live Group Status Cards */}
          {activeBatch && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Group Pipeline Progress
              </h4>
              <EbookGroupAccordion
                groups={activeBatch.groups}
                settings={settings}
                boards={boards}
                websites={websites}
                onGroupUpdated={handleGroupUpdated}
              />
            </div>
          )}
        </div>
      )}

      {/* STEP 4: RESULTS DASHBOARD */}
      {currentStep === 'results' && activeBatch && (
        <EbookResultsDashboard
          batch={activeBatch}
          boards={boards}
          websites={websites}
          onRetryFailed={() => handleStartGeneration(false)}
          onRetryUploads={handleRetryUploads}
          onGroupUpdated={handleGroupUpdated}
          onExportToPins={onExportToPins}
          onNewBatch={handleStartFreshBatch}
        />
      )}

      {/* MODAL: Import Pins from Library */}
      {isImportLibraryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/95 dark:bg-black/90 dark:backdrop-blur-2xl border border-slate-200 dark:border-white/[0.12] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col amoled-card">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Library className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Import Images from Pin Library ({pins.length})
                </h3>
              </div>
              <button
                onClick={() => setIsImportLibraryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 pr-1">
              {pins.map((pin) => {
                const isSelected = selectedLibraryPinIds.has(pin.id);
                return (
                  <div
                    key={pin.id}
                    onClick={() => {
                      setSelectedLibraryPinIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(pin.id)) next.delete(pin.id);
                        else next.add(pin.id);
                        return next;
                      });
                    }}
                    className={`border rounded-xl p-1.5 cursor-pointer transition-all flex flex-col ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-white/[0.04] relative">
                      <img
                        src={pin.imageUrl || pin.thumbnailUrl}
                        alt={pin.title}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate mt-1">
                      {pin.title || pin.filename}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 dark:border-white/[0.08] pt-3 flex items-center justify-between">
              <button
                onClick={() => {
                  if (selectedLibraryPinIds.size === pins.length) {
                    setSelectedLibraryPinIds(new Set());
                  } else {
                    setSelectedLibraryPinIds(new Set(pins.map((p) => p.id)));
                  }
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {selectedLibraryPinIds.size === pins.length ? 'Deselect All' : 'Select All Pins'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsImportLibraryModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportPinsFromLibrary}
                  disabled={selectedLibraryPinIds.size === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-40 cursor-pointer"
                >
                  Import {selectedLibraryPinIds.size} Selected Images
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Direct PDF Uploader Modal */}
      {isDirectPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.1] rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08] mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/50 text-[#E60023]">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Direct PDF Uploader (No Page Extraction)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Upload PDFs directly to cloud storage, get permanent HTTPS download links, and export Excel or CSV sheet.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectPdfModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DirectPdfUploader onBackToPinsMode={() => setIsDirectPdfModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
