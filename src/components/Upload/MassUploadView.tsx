import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Sparkles, 
  Check, 
  RotateCw, 
  AlertCircle, 
  Clock, 
  Layers, 
  Send, 
  CalendarClock, 
  Trash2, 
  Image as ImageIcon,
  CheckCircle2,
  Edit3,
  Copy,
  Globe,
  Shuffle,
  FileText,
  FileSpreadsheet,
  Link2
} from 'lucide-react';
import { Pin, Board, Website, AiProviderType } from '../../types';
import { aiMetadataQueue } from '../../services/aiMetadataEngine';
import { formatTagsForPinterest } from '../../services/tagsHelper';
import { PinCopyModal } from '../Clipboard/PinCopyModal';
import { UrlSplitDistributionModal } from '../Tools/UrlSplitDistributionModal';
import { createThumbnail } from '../../services/imageUtils';
import { extractPagesFromPdf } from '../../services/pdfImportService';
import { DirectPdfUploader } from './DirectPdfUploader';
import { AiCostConfirmModal } from '../AI/AiCostConfirmModal';

interface MassUploadViewProps {
  onPinsCreated: (newPins: Pin[]) => void;
  boards: Board[];
  websites: Website[];
  defaultBoardId?: string;
  defaultWebsiteId?: string;
  onOpenBulkEdit: (pins: Pin[]) => void;
  onOpenAutoSchedule: (pins: Pin[]) => void;
  onEditPin?: (pin: Pin) => void;
  onDeletePins?: (ids: string[]) => void;
  onDownloadZip?: (pins: Pin[]) => void;
  onPublishPins?: (pins: Pin[]) => void;
  onOpenWatermark?: (pins: Pin[]) => void;
  onOpenAspectRatio?: (pins: Pin[]) => void;
  onOpenUtmBuilder?: (pins: Pin[]) => void;
  aiLanguage?: string;
  autoStartAiOnUpload?: boolean;
  aiMinDelaySeconds?: number;
  aiMaxDelaySeconds?: number;
}

export const MassUploadView: React.FC<MassUploadViewProps> = ({
  onPinsCreated,
  boards,
  websites,
  defaultBoardId,
  defaultWebsiteId,
  onOpenBulkEdit,
  onOpenAutoSchedule,
  onEditPin,
  onDeletePins,
  onPublishPins,
  aiLanguage = 'English',
  autoStartAiOnUpload = true,
  aiMinDelaySeconds = 15,
  aiMaxDelaySeconds = 30,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedPins, setUploadedPins] = useState<Pin[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingStatusMessage, setProcessingStatusMessage] = useState<string>('');
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState<'all' | 'images' | 'pdf' | 'pdf-direct'>('all');
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Quick batch apply defaults
  const [batchDestinationUrl, setBatchDestinationUrl] = useState('');
  const [batchBoardId, setBatchBoardId] = useState(defaultBoardId || '');
  const [batchWebsiteId, setBatchWebsiteId] = useState(defaultWebsiteId || '');
  const [batchCustomPrompt, setBatchCustomPrompt] = useState('');
  const [showUrlSplitModal, setShowUrlSplitModal] = useState(false);
  
  // AI Modal
  const [showAiConfirmModal, setShowAiConfirmModal] = useState(false);
  const [pinsToAnalyze, setPinsToAnalyze] = useState<Pin[]>([]);

  // Handle local image file and PDF uploads
  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);
    setProcessingStatusMessage('Analyzing uploaded files...');

    const newPins: Pin[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      // 1. Handle PDF Documents
      if (isPdf) {
        setProcessingStatusMessage(`Extracting pages from PDF: ${file.name}...`);
        try {
          const pages = await extractPagesFromPdf(file, {
            scale: 1.6,
            quality: 0.88,
            onProgress: (current, total, message) => {
              setPdfProgress({ current, total, message });
              setProcessingStatusMessage(`PDF [${file.name}]: ${message}`);
            },
          });

          for (let pIdx = 0; pIdx < pages.length; pIdx++) {
            const page = pages[pIdx];
            const pinId = `pin_pdf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}_${newPins.length}`;

            const pin: Pin = {
              id: pinId,
              filename: page.filename,
              imageUrl: page.dataUrl,
              thumbnailUrl: page.thumbnailUrl || page.dataUrl,
              title: page.title,
              description: '',
              altText: page.title,
              tags: [],
              destinationUrl: batchDestinationUrl || '',
              boardId: batchBoardId || defaultBoardId || undefined,
              websiteId: batchWebsiteId || defaultWebsiteId || undefined,
              status: 'draft',
              aiStatus: 'waiting',
              aiGenerated: false,
              titleManuallyEdited: false,
              descriptionManuallyEdited: false,
              tagsManuallyEdited: false,
              scheduledAt: null,
              publishedAt: null,
              createdAt: now,
              updatedAt: now,
            };

            newPins.push(pin);
          }
        } catch (pdfErr) {
          console.error('Error importing PDF document:', file.name, pdfErr);
          alert(`Error reading PDF file: ${file.name}. Please ensure the PDF is not password protected.`);
        } finally {
          setPdfProgress(null);
        }
        continue;
      }

      // 2. Handle Regular Images
      if (!file.type.startsWith('image/')) continue;

      const id = `pin_${Date.now()}_${Math.random().toString(36).substr(2, 7)}_${i}`;
      const cleanTitle = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();

      try {
        // Read and optimize image
        const { fullUrl, thumbnailUrl } = await createThumbnail(file, 360, 0.82);
        if (!fullUrl) continue;

        const pin: Pin = {
          id,
          filename: file.name,
          imageUrl: fullUrl,
          thumbnailUrl: thumbnailUrl || fullUrl,
          title: cleanTitle,
          description: '',
          altText: cleanTitle,
          tags: [],
          destinationUrl: batchDestinationUrl || '',
          boardId: batchBoardId || defaultBoardId || undefined,
          websiteId: batchWebsiteId || defaultWebsiteId || undefined,
          aiCustomPrompt: batchCustomPrompt.trim() || undefined,
          status: 'draft',
          aiStatus: 'waiting',
          aiGenerated: false,
          titleManuallyEdited: false,
          descriptionManuallyEdited: false,
          tagsManuallyEdited: false,
          scheduledAt: null,
          publishedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        newPins.push(pin);
      } catch (err) {
        console.error('Error processing uploaded file:', file.name, err);
      }

      // Yield every 2 images to keep UI completely responsive
      if (i % 2 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    setIsProcessingFiles(false);
    setProcessingStatusMessage('');
    if (newPins.length > 0) {
      setUploadedPins(prev => [...newPins, ...prev]);
      onPinsCreated(newPins);
    }
  };

  const handleApplyBatchSettings = () => {
    if (uploadedPins.length === 0) return;
    const now = new Date().toISOString();

    const updated = uploadedPins.map(p => ({
      ...p,
      destinationUrl: batchDestinationUrl || p.destinationUrl,
      boardId: batchBoardId || p.boardId,
      websiteId: batchWebsiteId || p.websiteId,
      aiCustomPrompt: batchCustomPrompt.trim() || p.aiCustomPrompt,
      updatedAt: now,
    }));

    setUploadedPins(updated);
    onPinsCreated(updated);
  };

  const handleStartAiForBatch = () => {
    const pendingPins = uploadedPins.filter(p => p.aiStatus === 'waiting' || p.aiStatus === 'pending' || p.aiStatus === 'failed');
    const target = pendingPins.length > 0 ? pendingPins : uploadedPins;
    
    // Open modal instead of starting queue immediately
    setPinsToAnalyze(target);
    setShowAiConfirmModal(true);
  };

  const handleConfirmAi = (customPrompt?: string, provider?: string) => {
    aiMetadataQueue.setForcedProvider(provider as AiProviderType);
    
    aiMetadataQueue.enqueuePins(
      pinsToAnalyze, 
      aiLanguage, 
      (updatedPin) => {
        setUploadedPins(prev => {
          const idx = prev.findIndex(p => p.id === updatedPin.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = updatedPin;
            return copy;
          }
          return prev;
        });
      },
      aiMinDelaySeconds,
      aiMaxDelaySeconds,
      customPrompt
    );
  };

  const handleRetrySinglePin = async (pin: Pin, e: React.MouseEvent) => {
    e.stopPropagation();
    await aiMetadataQueue.processSinglePin(pin, aiLanguage, (updatedPin) => {
      setUploadedPins(prev => {
        const idx = prev.findIndex(p => p.id === updatedPin.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updatedPin;
          return copy;
        }
        return prev;
      });
    });
  };

  const handleDeleteSinglePin = (pinId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedPins(prev => prev.filter(p => p.id !== pinId));
    if (onDeletePins) {
      onDeletePins([pinId]);
    }
  };

  const handleDeleteAllUploaded = () => {
    if (uploadedPins.length === 0) return;
    const ids = uploadedPins.map(p => p.id);
    setUploadedPins([]);
    if (onDeletePins) {
      onDeletePins(ids);
    }
  };

  const getAiBadge = (pin: Pin) => {
    const providerLabel = pin.aiProviderUsed === 'pollinations' ? 'Pollinations' : 'Gemini';

    switch (pin.aiStatus) {
      case 'success':
      case 'completed':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold shadow-sm" 
            title={`AI Analysis generated successfully using ${providerLabel}`}
          >
            <Check className="w-2.5 h-2.5" />
            <span>{providerLabel} ✓</span>
          </span>
        );
      case 'analyzing':
      case 'processing':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-bold animate-pulse shadow-sm" 
            title={pin.aiStatusDetails || "Analyzing image features..."}
          >
            <RotateCw className="w-2.5 h-2.5 animate-spin" />
            <span>Analyzing...</span>
          </span>
        );
      case 'retrying':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold shadow-sm animate-pulse" 
            title={pin.aiStatusDetails || `Retrying attempt ${pin.aiRetryAttempt || 1}`}
          >
            <RotateCw className="w-2.5 h-2.5 animate-spin" />
            <span>Retry {pin.aiRetryAttempt ? `#${pin.aiRetryAttempt}` : ''}</span>
          </span>
        );
      case 'failed':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-bold shadow-sm" 
            title={pin.aiError || 'Failed'}
          >
            <AlertCircle className="w-2.5 h-2.5" /> Failed
          </span>
        );
      case 'waiting':
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 text-slate-200 text-[9px] font-bold shadow-sm" title="Waiting in AI Queue">
            <Clock className="w-2.5 h-2.5" /> Waiting
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header Bento Card */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-6 rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors amoled-card">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-[#E60023] dark:text-red-400 border border-red-200/80 dark:border-red-800/60 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> High-Speed Mass Upload
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Upload & AI Metadata Hub</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Drop 1 to 500+ images. Gemini analyzes each image sequentially with 15s–30s pacing to generate titles, descriptions, and tags.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {uploadedPins.length > 0 ? (
            <button
              type="button"
              onClick={handleStartAiForBatch}
              className="flex items-center gap-1.5 bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate AI Metadata ({uploadedPins.filter(p => p.aiStatus === 'pending' || p.aiStatus === 'failed').length} Ready)</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Upload Mode Selector (All Files, Images, PDF Upload) */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center p-1 bg-slate-100 dark:bg-white/[0.06] rounded-2xl border border-slate-200/80 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => setUploadMode('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              uploadMode === 'all'
                ? 'bg-white dark:bg-black/60 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
            <span>All Supported Files</span>
          </button>

          <button
            type="button"
            onClick={() => setUploadMode('images')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              uploadMode === 'images'
                ? 'bg-white dark:bg-black/60 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Images Only (JPG / PNG)</span>
          </button>

          <button
            type="button"
            id="tab-pdf-upload"
            onClick={() => setUploadMode('pdf')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              uploadMode === 'pdf'
                ? 'bg-[#E60023] text-white shadow-xs'
                : 'text-slate-500 hover:text-[#E60023] dark:hover:text-red-400'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${uploadMode === 'pdf' ? 'text-white' : 'text-[#E60023]'}`} />
            <span>PDF to Pins (Extract)</span>
          </button>

          <button
            type="button"
            id="tab-pdf-direct-upload"
            onClick={() => setUploadMode('pdf-direct')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              uploadMode === 'pdf-direct'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-[#E60023] dark:hover:text-red-400'
            }`}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${uploadMode === 'pdf-direct' ? 'text-white' : 'text-emerald-500'}`} />
            <span>PDF Direct Link & Sheet</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono font-bold ${uploadMode === 'pdf-direct' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>No Slicing</span>
          </button>
        </div>

        {uploadMode === 'pdf' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Extracting each page as an image pin. Need direct PDF link without extraction? Switch to <button type="button" onClick={() => setUploadMode('pdf-direct')} className="text-red-600 dark:text-red-400 font-bold hover:underline ml-1">PDF Direct Link & Sheet</button></span>
          </div>
        )}
      </div>

      {uploadMode === 'pdf-direct' ? (
        <DirectPdfUploader onBackToPinsMode={() => setUploadMode('pdf')} />
      ) : (
        <>
          {/* Option banner when in PDF mode */}
          {uploadMode === 'pdf' && (
            <div className="bg-slate-50/80 dark:bg-white/[0.03] p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">PDF Import Mode:</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Currently extracting every page into image pins. To just upload the PDF, get its direct download link, and export an Excel sheet, switch mode:
                </p>
              </div>
              <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-white/[0.08] p-1 rounded-xl text-xs font-bold shrink-0">
                <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-black/60 text-slate-900 dark:text-white shadow-xs">
                  Extract Pages to Pins
                </span>
                <button
                  type="button"
                  onClick={() => setUploadMode('pdf-direct')}
                  className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Just Upload & Export Sheet</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Drag & Drop Box */}
      <div
        data-dropzone="true"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all flex flex-col items-center justify-center gap-3 ${
          dragOver
            ? 'border-[#E60023] bg-red-50/50 dark:bg-red-950/20 scale-[0.99]'
            : uploadMode === 'pdf'
            ? 'border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10 shadow-xs amoled-card'
            : 'border-slate-300 dark:border-white/[0.12] hover:border-slate-400 dark:hover:border-white/[0.25] bg-white/80 dark:bg-black/40 dark:backdrop-blur-xl shadow-xs amoled-card'
        }`}
      >
        {/* Main files input (Images & PDF) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {/* Dedicated PDF input */}
        <input
          ref={pdfFileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {/* Dynamic State Icon */}
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/50 text-[#E60023] dark:text-red-400 flex items-center justify-center shadow-2xs border border-transparent dark:border-red-900/40">
          {pdfProgress ? (
            <RotateCw className="w-7 h-7 animate-spin text-[#E60023]" />
          ) : isProcessingFiles ? (
            <RotateCw className="w-7 h-7 animate-spin" />
          ) : (
            <UploadCloud className="w-7 h-7" />
          )}
        </div>

        {/* PDF Ingest Live Progress Bar */}
        {pdfProgress ? (
          <div className="w-full max-w-md space-y-2 py-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#E60023]" />
                <span>Importing PDF Pages</span>
              </span>
              <span>
                Page {pdfProgress.current} of {pdfProgress.total}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#E60023] h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(5, Math.round((pdfProgress.current / Math.max(1, pdfProgress.total)) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
              {pdfProgress.message}
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-w-lg">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {isProcessingFiles
                ? processingStatusMessage || 'Reading Files...'
                : uploadMode === 'pdf'
                ? 'Drop PDF Documents Here'
                : uploadMode === 'images'
                ? 'Drop Pinterest Images Here'
                : 'Drag & Drop Images or PDF Files Here'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {uploadMode === 'pdf' ? (
                <>Upload multi-page <strong className="text-slate-700 dark:text-slate-200">PDF eBooks, slides or brochures</strong>. Each page is converted automatically into an ultra-sharp Pinterest pin draft.</>
              ) : uploadMode === 'images' ? (
                <>Supports JPG, PNG, WEBP. Select up to 500+ images for rapid batch processing and sequential Gemini AI metadata generation.</>
              ) : (
                <>Supports JPG, PNG, WEBP and <strong className="text-slate-700 dark:text-slate-200">PDF Documents</strong>. Multi-page PDFs are automatically converted into separate Pinterest pins page-by-page.</>
              )}
            </p>
          </div>
        )}

        {/* Action Buttons for Image vs PDF */}
        {!isProcessingFiles && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
            {uploadMode !== 'pdf' && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#F7F7F9] dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Browse Images</span>
              </button>
            )}

            {uploadMode !== 'images' && (
              <button
                type="button"
                id="upload-pdf-btn"
                onClick={() => pdfFileInputRef.current?.click()}
                className="bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-[#E60023] dark:text-red-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-red-200/80 dark:border-red-900/60 cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-[#E60023] dark:text-red-400" />
                <span>Upload PDF Document</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Batch Defaults Bar */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-5 rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs space-y-3 transition-colors amoled-card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Quick Batch Defaults & Website Linking (Optional)
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Pre-fill or split values across all uploaded pins
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 flex gap-2">
            <input
              type="url"
              placeholder="Batch Destination URL (e.g. https://yoursite.com/post)"
              value={batchDestinationUrl}
              onChange={(e) => setBatchDestinationUrl(e.target.value)}
              className="flex-1 text-xs font-mono p-2.5 bg-[#F7F7F9] dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={batchWebsiteId}
              onChange={(e) => {
                const wId = e.target.value;
                setBatchWebsiteId(wId);
                const selectedSite = websites.find(w => w.id === wId);
                if (selectedSite) {
                  setBatchDestinationUrl(selectedSite.url);
                }
              }}
              className="w-full text-xs font-medium p-2.5 bg-[#F7F7F9] dark:bg-black/80 border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            >
              <option value="">Link Added Website...</option>
              {websites.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.url})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={batchBoardId}
              onChange={(e) => setBatchBoardId(e.target.value)}
              className="w-full text-xs font-medium p-2.5 bg-[#F7F7F9] dark:bg-black/80 border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            >
              <option value="">Select Target Board...</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={handleApplyBatchSettings}
              disabled={uploadedPins.length === 0}
              className="w-full bg-[#F7F7F9] dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.1] border border-slate-200/80 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-40 shadow-2xs"
            >
              Apply ({uploadedPins.length})
            </button>
          </div>
        </div>

        {/* Batch AI Prompt / Topic Guidance Row */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06] space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
              <span>Batch AI Topic / Prompt (ما تريده ليبني عليه الـ AI لجميع الصور)</span>
            </label>
            {batchCustomPrompt && (
              <button
                type="button"
                onClick={() => setBatchCustomPrompt('')}
                className="text-[11px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="اكتب هنا ما تريد أن يبني عليه الـ AI (مثال: أفكار ديكور حديثة، نصائح لتوفير المال، خطوات سريعة، كلمات مفتاحية معينة)..."
              value={batchCustomPrompt}
              onChange={(e) => setBatchCustomPrompt(e.target.value)}
              className="flex-1 text-xs font-normal p-2.5 bg-[#F7F7F9] dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            />
            <button
              type="button"
              onClick={handleApplyBatchSettings}
              disabled={uploadedPins.length === 0}
              className="bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-[#E60023] dark:text-red-300 border border-red-200/80 dark:border-red-900/50 text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer transition-colors disabled:opacity-40 flex items-center gap-1"
              title="Apply prompt to all uploaded pins"
            >
              <Sparkles className="w-3 h-3" />
              <span>Apply Prompt</span>
            </button>
          </div>
        </div>
      </div>

      {/* Uploaded Pins Stage */}
      {uploadedPins.length > 0 ? (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-black/80 dark:backdrop-blur-2xl text-white p-4 rounded-3xl shadow-xl border border-white/[0.1]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold font-mono">
                {uploadedPins.length} Uploaded Pins
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-xs text-emerald-400 font-bold font-mono">
                {uploadedPins.filter(p => p.aiStatus === 'success' || p.aiStatus === 'completed').length} AI Success
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartAiForBatch}
                className="text-xs font-extrabold bg-[#E60023] hover:bg-[#ad001a] px-3.5 py-1.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Generate All
              </button>
              <button
                type="button"
                onClick={() => setShowCopyModal(true)}
                className="text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] px-3 py-1.5 rounded-xl border border-white/[0.1] cursor-pointer flex items-center gap-1.5 text-pink-300"
                title="Copy all uploaded pins to paste into Pinterest"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Pin Set ({uploadedPins.length})
              </button>
              <button
                type="button"
                onClick={() => setShowUrlSplitModal(true)}
                className="text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] px-3 py-1.5 rounded-xl border border-white/[0.1] cursor-pointer flex items-center gap-1.5 text-rose-300"
                title="Split or distribute website URLs across uploaded pins"
              >
                <Globe className="w-3.5 h-3.5" /> Split / Link URLs
              </button>
              <button
                type="button"
                onClick={() => onOpenBulkEdit(uploadedPins)}
                className="text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] px-3 py-1.5 rounded-xl border border-white/[0.1] cursor-pointer"
              >
                Bulk Edit
              </button>
              <button
                type="button"
                onClick={() => onOpenAutoSchedule(uploadedPins)}
                className="text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] px-3 py-1.5 rounded-xl border border-white/[0.1] cursor-pointer"
              >
                Auto Schedule
              </button>
              <button
                type="button"
                onClick={() => onPublishPins(uploadedPins)}
                className="text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl cursor-pointer shadow-xs"
              >
                Publish All
              </button>
              <button
                type="button"
                onClick={handleDeleteAllUploaded}
                className="text-xs font-semibold text-rose-400 hover:bg-rose-950/60 p-1.5 rounded-xl cursor-pointer"
                title="Delete All Uploaded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grid Preview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {uploadedPins.map((pin) => (
              <div
                key={pin.id}
                onClick={() => onEditPin(pin)}
                className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden group cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.2] transition-all flex flex-col shadow-2xs hover:shadow-xs amoled-card"
              >
                <div className="aspect-[2/3] bg-slate-100 dark:bg-black/40 relative overflow-hidden">
                  <img
                    src={pin.thumbnailUrl || pin.imageUrl}
                    alt={pin.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* AI Status Badge */}
                  <div className="absolute top-2 right-2 z-10">
                    {getAiBadge(pin)}
                  </div>

                  {/* ALWAYS VISIBLE RETRY AI BUTTON ON IMAGE */}
                  <button
                    type="button"
                    onClick={(e) => handleRetrySinglePin(pin, e)}
                    disabled={pin.aiStatus === 'processing'}
                    className="absolute bottom-2 left-2 z-10 bg-black/80 hover:bg-[#E60023] text-white p-1.5 rounded-xl backdrop-blur-md transition-all shadow-xs cursor-pointer flex items-center gap-1 text-[10px] font-bold border border-white/[0.08]"
                    title="Retry / Regenerate AI Metadata for this image"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${pin.aiStatus === 'processing' ? 'animate-spin' : ''}`} />
                    <span className="hidden group-hover:inline pr-0.5">Retry AI</span>
                  </button>

                  {/* DELETE BUTTON ON IMAGE */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSinglePin(pin.id, e)}
                    className="absolute bottom-2 right-2 z-10 bg-black/80 hover:bg-rose-600 text-white p-1.5 rounded-xl backdrop-blur-md transition-all shadow-xs cursor-pointer opacity-80 group-hover:opacity-100 border border-white/[0.08]"
                    title="Delete Uploaded Pin"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3 space-y-1 text-left flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#E60023] truncate transition-colors">
                      {pin.title || pin.filename}
                    </h4>
                    {pin.tags && pin.tags.length > 0 ? (
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-medium truncate block" title={formatTagsForPinterest(pin.tags)}>
                        {formatTagsForPinterest(pin.tags.slice(0, 3))}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate block">
                        {pin.filename}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[10px] text-[#E60023] dark:text-red-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-2.5 h-2.5" /> Edit Pin
                    </span>
                    {pin.destinationUrl ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      </>
      )}

      {/* Pin Copy Modal for Mass Uploaded Pins */}
      {showCopyModal && uploadedPins.length > 0 && (
        <PinCopyModal
          isOpen={showCopyModal}
          onClose={() => setShowCopyModal(false)}
          pins={uploadedPins}
          boards={boards}
        />
      )}

      {/* URL Split & Website Link Modal */}
      {showUrlSplitModal && uploadedPins.length > 0 && (
        <UrlSplitDistributionModal
          isOpen={showUrlSplitModal}
          onClose={() => setShowUrlSplitModal(false)}
          pins={uploadedPins}
          websites={websites}
          onApply={(updated) => {
            setUploadedPins(updated);
            onPinsCreated(updated);
          }}
        />
      )}
      
      {/* AI Confirm Modal */}
      {showAiConfirmModal && pinsToAnalyze.length > 0 && (
        <AiCostConfirmModal
          isOpen={showAiConfirmModal}
          onClose={() => setShowAiConfirmModal(false)}
          pins={pinsToAnalyze}
          language={aiLanguage}
          initialCustomPrompt={batchCustomPrompt.trim()}
          onConfirm={handleConfirmAi}
        />
      )}
    </div>
  );
};
