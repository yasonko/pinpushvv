import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Pin, 
  Board, 
  Website, 
  PinStatus 
} from '../../types';
import { 
  copyToClipboard, 
  copyImageToClipboard, 
  downloadPinImageFile, 
  openPinterestPinBuilder, 
  formatSinglePin 
} from '../../services/clipboardHelper';
import { 
  copyPinToExtension, 
  copyQueueToExtension,
  downloadExtensionZip, 
  openPinterestWithAssistant 
} from '../../services/extensionBridge';
import { sanitizeTagList } from '../../services/tagsHelper';
import { BulkExportSection } from '../Bulk/BulkExportSection';
import { 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  FolderHeart, 
  Globe, 
  Hash, 
  HelpCircle, 
  Tag, 
  Layers, 
  Image as ImageIcon,
  Send,
  Filter,
  CheckCheck,
  Zap,
  ArrowRight,
  RefreshCw,
  Clock,
  CalendarClock,
  Edit3,
  Flame,
  CheckSquare,
  Eye,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Columns,
  Maximize2,
  Minimize2,
  Layout
} from 'lucide-react';

const ASSISTANT_SPLIT_MODE_KEY = 'pin_assistant_split_view_mode';
const ASSISTANT_SPLIT_RATIO_KEY = 'pin_assistant_split_ratio';

type SplitViewMode = 'split' | 'hide-left' | 'hide-right';
type SplitViewRatio = '5-7' | '6-6' | '4-8';

interface PublishingAssistantViewProps {
  pins: Pin[];
  boards: Board[];
  websites: Website[];
  onUpdatePin: (pin: Pin) => void;
  onOpenUpload: () => void;
  onEditPin?: (pin: Pin) => void;
  initialPinId?: string | null;
  language?: string;
  onOpenAutoSchedule?: (targetPins?: Pin[]) => void;
  onOpenBulkEdit?: (targetPins?: Pin[]) => void;
  onRetryAiPin?: (pin: Pin) => void;
  onOpenImportCsv?: () => void;
}

export const PublishingAssistantView: React.FC<PublishingAssistantViewProps> = ({
  pins,
  boards,
  websites,
  onUpdatePin,
  onOpenUpload,
  onEditPin,
  initialPinId,
  onOpenAutoSchedule,
  onOpenBulkEdit,
  onRetryAiPin,
  onOpenImportCsv,
}) => {
  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'scheduled' | 'manual_required' | 'draft' | 'published' | 'failed'>('all');
  const [selectedBoardFilter, setSelectedBoardFilter] = useState<string>('all');
  const [tagFormat, setTagFormat] = useState<'comma' | 'hashtag' | 'lines'>('comma');

  // Split View Space Controls state
  const [splitViewMode, setSplitViewMode] = useState<SplitViewMode>(() => {
    try {
      const saved = localStorage.getItem(ASSISTANT_SPLIT_MODE_KEY);
      if (saved === 'hide-left' || saved === 'hide-right' || saved === 'split') return saved;
    } catch (e) {}
    return 'split';
  });

  const [splitRatio, setSplitRatio] = useState<SplitViewRatio>(() => {
    try {
      const saved = localStorage.getItem(ASSISTANT_SPLIT_RATIO_KEY);
      if (saved === '6-6' || saved === '4-8' || saved === '5-7') return saved;
    } catch (e) {}
    return '5-7';
  });

  const changeSplitViewMode = useCallback((mode: SplitViewMode) => {
    setSplitViewMode(mode);
    try {
      localStorage.setItem(ASSISTANT_SPLIT_MODE_KEY, mode);
    } catch (e) {}
  }, []);

  const changeSplitRatio = useCallback((ratio: SplitViewRatio) => {
    setSplitRatio(ratio);
    try {
      localStorage.setItem(ASSISTANT_SPLIT_RATIO_KEY, ratio);
    } catch (e) {}
  }, []);

  // Copy feedback state tracking
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  // Shortcut help modal toggle
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);

  // Current active pin index in the filtered list
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Filtered pins
  const filteredPins = useMemo(() => {
    return pins.filter(pin => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'ready' && pin.status !== 'ready' && pin.status !== 'draft') return false;
        if (statusFilter === 'scheduled' && pin.status !== 'scheduled') return false;
        if (statusFilter === 'manual_required' && pin.status !== 'manual_required') return false;
        if (statusFilter === 'published' && pin.status !== 'published') return false;
        if (statusFilter === 'failed' && pin.status !== 'failed') return false;
        if (statusFilter === 'draft' && pin.status !== 'draft') return false;
      }

      // Board filter
      if (selectedBoardFilter !== 'all' && pin.boardId !== selectedBoardFilter) {
        return false;
      }

      return true;
    });
  }, [pins, statusFilter, selectedBoardFilter]);

  // Set initial pin index if provided
  useEffect(() => {
    if (initialPinId && filteredPins.length > 0) {
      const idx = filteredPins.findIndex(p => p.id === initialPinId);
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    }
  }, [initialPinId, filteredPins]);

  // Clamp current index within bounds
  useEffect(() => {
    if (currentIndex >= filteredPins.length && filteredPins.length > 0) {
      setCurrentIndex(filteredPins.length - 1);
    }
  }, [filteredPins.length, currentIndex]);

  const currentPin: Pin | undefined = filteredPins[currentIndex];
  const currentBoard = boards.find(b => b.id === currentPin?.boardId);
  const currentWebsite = websites.find(w => w.id === currentPin?.websiteId);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < filteredPins.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, filteredPins.length]);

  // Notification helper
  const triggerCopyFeedback = (fieldName: string, customMsg?: string) => {
    setCopiedField(fieldName);
    setCopiedMessage(customMsg || `Copied ${fieldName} to clipboard!`);
    setTimeout(() => {
      setCopiedField(null);
      setCopiedMessage(null);
    }, 2000);
  };

  // Copy individual field
  const handleCopyField = async (fieldName: string, textToCopy: string) => {
    if (!textToCopy) return;
    const success = await copyToClipboard(textToCopy);
    if (success) {
      triggerCopyFeedback(fieldName);
    }
  };

  // Copy tags formatted
  const getFormattedTags = useCallback(() => {
    if (!currentPin?.tags || currentPin.tags.length === 0) return '';
    const cleanTags = sanitizeTagList(currentPin.tags);
    if (tagFormat === 'hashtag') {
      return cleanTags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ');
    }
    if (tagFormat === 'lines') {
      return cleanTags.join('\n');
    }
    return cleanTags.join(', ');
  }, [currentPin?.tags, tagFormat]);

  // Copy ALL pin metadata in structured format
  const handleCopyAll = async () => {
    if (!currentPin) return;
    const structuredText = formatSinglePin(currentPin, currentBoard?.name);
    const success = await copyToClipboard(structuredText);
    if (success) {
      triggerCopyFeedback('all', '✓ Copied all Pin fields in structured format!');
    }
  };

  // Copy Image directly
  const handleCopyImage = async () => {
    if (!currentPin?.imageUrl) return;
    const success = await copyImageToClipboard(currentPin.imageUrl);
    if (success) {
      triggerCopyFeedback('image', '✓ Image copied to clipboard ready to paste into Pinterest!');
    } else {
      // Fallback: trigger download
      downloadPinImageFile(currentPin.imageUrl, currentPin.filename);
      triggerCopyFeedback('image', '✓ Image downloaded for upload into Pinterest!');
    }
  };

  // Download Image
  const handleDownloadImage = () => {
    if (!currentPin?.imageUrl) return;
    downloadPinImageFile(currentPin.imageUrl, currentPin.filename);
    triggerCopyFeedback('download', '✓ Image downloaded to your device!');
  };

  // Mark as Published & Advance
  const handleMarkPublished = useCallback(() => {
    if (!currentPin) return;
    const updated: Pin = {
      ...currentPin,
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpdatePin(updated);
    triggerCopyFeedback('status', `✓ Marked "${currentPin.title || currentPin.filename}" as Published!`);

    // Auto-advance to next pin after short delay
    if (currentIndex < filteredPins.length - 1) {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 400);
    }
  }, [currentPin, currentIndex, filteredPins.length, onUpdatePin]);

  // Mark as Manual Required
  const handleMarkManualRequired = () => {
    if (!currentPin) return;
    const updated: Pin = {
      ...currentPin,
      status: 'manual_required',
      updatedAt: new Date().toISOString(),
    };
    onUpdatePin(updated);
    triggerCopyFeedback('manual', 'Flagged as Manual Required');
  };

  // Mark as Ready
  const handleMarkReady = () => {
    if (!currentPin) return;
    const updated: Pin = {
      ...currentPin,
      status: 'ready',
      updatedAt: new Date().toISOString(),
    };
    onUpdatePin(updated);
    triggerCopyFeedback('ready', 'Marked as Ready to Publish');
  };

  // Copy to Pinterest Assistant Extension (Single)
  const handleCopyToExtension = async () => {
    if (!currentPin) return;
    const res = await copyPinToExtension(currentPin, currentBoard?.name);
    triggerCopyFeedback('extension', res.message);
  };

  // Copy Full Filtered Queue to Pinterest Assistant Extension
  const handleCopyQueueToExtension = async () => {
    if (filteredPins.length === 0) return;
    const res = await copyQueueToExtension(filteredPins, boards);
    triggerCopyFeedback('extension', res.message);
  };

  // Open Pinterest Pin Builder
  const handleOpenPinterest = () => {
    openPinterestPinBuilder();
    triggerCopyFeedback('pinterest', 'Opened Pinterest Create Pin in new tab');
  };

  // Keyboard Shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is actively typing in an input/textarea, do not capture single keys
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      // Alt + 1 -> Toggle Left Panel (Image & Quick Action Cockpit)
      if (e.altKey && (e.key === '1')) {
        e.preventDefault();
        changeSplitViewMode(splitViewMode === 'hide-left' ? 'split' : 'hide-left');
      }
      // Alt + 2 -> Toggle Right Panel (Metadata Editor)
      else if (e.altKey && (e.key === '2')) {
        e.preventDefault();
        changeSplitViewMode(splitViewMode === 'hide-right' ? 'split' : 'hide-right');
      }
      // Alt + S -> Reset to Split View
      else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        changeSplitViewMode('split');
      }
      // Alt + Right -> Next Pin
      else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
      // Alt + Left -> Prev Pin
      else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
      // Ctrl + Shift + C or Cmd + Shift + C -> Copy All
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        handleCopyAll();
      }
      // Ctrl + Enter or Cmd + Enter -> Mark Published & Next
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleMarkPublished();
      }
      // Alt + P -> Open Pinterest
      else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handleOpenPinterest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleCopyAll, handleMarkPublished, splitViewMode, changeSplitViewMode]);

  // Overall stats
  const publishedCount = pins.filter(p => p.status === 'published').length;
  const readyCount = pins.filter(p => p.status === 'ready' || p.status === 'draft').length;
  const scheduledCount = pins.filter(p => p.status === 'scheduled').length;
  const manualCount = pins.filter(p => p.status === 'manual_required').length;
  const failedCount = pins.filter(p => p.status === 'failed').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast feedback banner */}
      {copiedMessage && (
        <div className="fixed top-5 right-5 z-50 bg-black/90 dark:bg-white/95 text-white dark:text-black px-4 py-2.5 rounded-2xl shadow-xl border border-white/[0.1] dark:border-slate-300 text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2 duration-150 backdrop-blur-xl">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{copiedMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/[0.08] p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors amoled-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-red-50 dark:bg-red-950/50 text-[#E60023] dark:text-red-400 flex items-center justify-center font-bold shadow-2xs border border-transparent dark:border-red-900/40">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                <span>Pinterest Publishing Assistant</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                  Manual Speed Workflow
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1-Click Copy, download images, open Pinterest pin builder, and mark published in seconds.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={downloadExtensionZip}
            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Download Chrome Extension (.ZIP) to load unpacked in chrome://extensions"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Extension (.ZIP)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowWorkflowGuide(true)}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <HelpCircle className="w-4 h-4 text-blue-500" />
            <span>Workflow Guide</span>
          </button>
          <button
            type="button"
            onClick={() => setShowShortcutsHelp(true)}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <span className="font-mono text-[10px] bg-slate-200 dark:bg-white/[0.1] px-1.5 py-0.5 rounded">Alt + →</span>
            <span>Shortcuts</span>
          </button>
          <button
            type="button"
            onClick={handleOpenPinterest}
            className="bg-[#E60023] hover:bg-[#ad001a] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all ml-auto md:ml-0 active:scale-95"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Pinterest Pin Builder</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      {pins.length === 0 ? (
        <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-12 text-center space-y-4 amoled-card">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 text-[#E60023] mx-auto flex items-center justify-center border border-transparent dark:border-red-900/40">
            <ImageIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Pins in Queue</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mass upload your images first to start generating SEO metadata and publishing pins.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenUpload}
            className="bg-[#E60023] hover:bg-[#ad001a] text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md cursor-pointer transition-all inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Start Mass Upload</span>
          </button>
        </div>
      ) : filteredPins.length === 0 ? (
        <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-10 text-center space-y-4 amoled-card">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Pins match current filter</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Try changing status filter to "All" or select another board.</p>
          </div>
          <button
            type="button"
            onClick={() => { setStatusFilter('all'); setSelectedBoardFilter('all'); }}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : currentPin ? (
        <div className="space-y-4">
          {/* Split View Space Controls Bar */}
          <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/[0.08] p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs transition-colors amoled-card">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Columns className="w-4 h-4 text-[#E60023]" />
                <span className="hidden sm:inline">Split View Layout:</span>
              </div>
              
              <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => changeSplitViewMode('split')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    splitViewMode === 'split'
                      ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Show both Image and Metadata panels side-by-side (Alt+S)"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Split View</span>
                </button>

                <button
                  type="button"
                  onClick={() => changeSplitViewMode(splitViewMode === 'hide-left' ? 'split' : 'hide-left')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    splitViewMode === 'hide-left'
                      ? 'bg-white dark:bg-white/[0.12] text-[#E60023] dark:text-red-400 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Hide Left Image Panel to expand Editor space (Alt+1)"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                  <span>{splitViewMode === 'hide-left' ? 'Image Hidden (Full Editor)' : 'Hide Image Panel'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => changeSplitViewMode(splitViewMode === 'hide-right' ? 'split' : 'hide-right')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    splitViewMode === 'hide-right'
                      ? 'bg-white dark:bg-white/[0.12] text-[#E60023] dark:text-red-400 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Hide Right Metadata Panel to expand Image Cockpit (Alt+2)"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                  <span>{splitViewMode === 'hide-right' ? 'Details Hidden (Full Image)' : 'Hide Details Panel'}</span>
                </button>
              </div>
            </div>

            {/* Ratio switcher & Shortcut Hint */}
            <div className="flex items-center gap-3">
              {splitViewMode === 'split' ? (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-medium hidden md:inline">Split Ratio:</span>
                  <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] p-0.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => changeSplitRatio('5-7')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        splitRatio === '5-7' ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 dark:text-slate-400'
                      }`}
                      title="Standard 5:7 split"
                    >
                      5 : 7
                    </button>
                    <button
                      type="button"
                      onClick={() => changeSplitRatio('6-6')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        splitRatio === '6-6' ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 dark:text-slate-400'
                      }`}
                      title="Equal 50/50 split"
                    >
                      50 / 50
                    </button>
                    <button
                      type="button"
                      onClick={() => changeSplitRatio('4-8')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        splitRatio === '4-8' ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 dark:text-slate-400'
                      }`}
                      title="Wide Editor 4:8 split"
                    >
                      4 : 8 (Wide Editor)
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => changeSplitViewMode('split')}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#E60023] flex items-center gap-1.5 cursor-pointer"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Restore Split View (Alt+S)</span>
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Image Preview & Fast Action Cockpit */}
            <div 
              className={`${
                splitViewMode === 'hide-left'
                  ? 'hidden'
                  : splitViewMode === 'hide-right'
                  ? 'lg:col-span-12'
                  : splitRatio === '6-6'
                  ? 'lg:col-span-6'
                  : splitRatio === '4-8'
                  ? 'lg:col-span-4'
                  : 'lg:col-span-5'
              } space-y-5`}
            >
              {/* Right Panel Hidden Notice Banner (when in hide-right mode) */}
              {splitViewMode === 'hide-right' && (
                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Layout className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        Right Details Panel Hidden (Full Visual Cockpit Active)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Maximize screen space for split-screen with Pinterest. Press <kbd className="font-mono bg-white dark:bg-white/[0.08] px-1 py-0.5 rounded border border-slate-200 dark:border-white/[0.08]">Alt + 2</kbd> or <kbd className="font-mono bg-white dark:bg-white/[0.08] px-1 py-0.5 rounded border border-slate-200 dark:border-white/[0.08]">Alt + S</kbd> to restore details.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeSplitViewMode('split')}
                    className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-white dark:bg-white/[0.06] hover:bg-blue-50 dark:hover:bg-white/[0.1] border border-blue-200 dark:border-blue-800 px-3.5 py-1.5 rounded-xl cursor-pointer shadow-xs shrink-0 flex items-center gap-1.5"
                  >
                    <PanelRightOpen className="w-4 h-4" />
                    <span>Show Details (Alt+2)</span>
                  </button>
                </div>
              )}

              {/* Visual Card */}
              <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-xs transition-colors amoled-card">
                {/* Card top toolbar */}
                <div className="p-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                      Pin {currentIndex + 1} of {filteredPins.length}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      currentPin.status === 'published'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : currentPin.status === 'scheduled'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        : currentPin.status === 'manual_required'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        : 'bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300'
                    }`}>
                      {currentPin.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-30 cursor-pointer transition-colors"
                      title="Previous Pin (Alt + Left)"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={currentIndex === filteredPins.length - 1}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-30 cursor-pointer transition-colors"
                      title="Next Pin (Alt + Right)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Hide Left Panel Button */}
                    <button
                      type="button"
                      onClick={() => changeSplitViewMode('hide-left')}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer transition-colors ml-1"
                      title="Hide Image Panel for more Editor space (Alt+1)"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              {/* Image display */}
              <div className="p-4 flex flex-col items-center justify-center bg-slate-900/5 dark:bg-black/50 min-h-[340px] max-h-[440px] overflow-hidden relative group">
                <img
                  src={currentPin.imageUrl}
                  alt={currentPin.title || currentPin.filename}
                  className="max-h-[380px] w-auto object-contain rounded-2xl shadow-md select-none pointer-events-auto"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              </div>

              {/* Image Quick Actions */}
              <div className="p-4 bg-slate-50 dark:bg-black/40 border-t border-slate-100 dark:border-white/[0.08] grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="bg-white dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-slate-800 dark:text-white font-bold text-xs p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-500" />
                  <span>Copy Image</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="bg-white dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-slate-800 dark:text-white font-bold text-xs p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Download Image</span>
                </button>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/[0.08] p-5 space-y-3 shadow-xs transition-colors amoled-card">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Speed Publishing Actions
              </h4>

              {/* 1-Click Copy to Extension */}
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleCopyToExtension}
                  className="w-full bg-[#E60023] hover:bg-[#ad001a] text-white font-extrabold text-xs py-3.5 px-4 rounded-2xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <Zap className="w-4 h-4 text-white" />
                  <span>COPY CURRENT PIN TO EXTENSION</span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono ml-auto">
                    Pin #{currentIndex + 1}
                  </span>
                </button>

                {filteredPins.length > 1 && (
                  <button
                    type="button"
                    onClick={handleCopyQueueToExtension}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs py-2.5 px-4 rounded-2xl shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    title="Send all filtered pins to the extension queue for continuous batch publishing"
                  >
                    <Layers className="w-4 h-4 text-white" />
                    <span>SEND BATCH QUEUE ({filteredPins.length} PINS) TO EXTENSION</span>
                  </button>
                )}
              </div>

              {/* Big 1-Click Copy All */}
              <button
                type="button"
                onClick={handleCopyAll}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-extrabold text-xs py-3.5 px-4 rounded-2xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <Copy className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                <span>COPY ALL PIN METADATA</span>
                <span className="font-mono text-[10px] bg-slate-800 dark:bg-slate-200 px-1.5 py-0.5 rounded ml-auto">
                  Ctrl+Shift+C
                </span>
              </button>

              {/* Big Mark as Published & Next */}
              <button
                type="button"
                onClick={handleMarkPublished}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-3.5 px-4 rounded-2xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>MARK PUBLISHED & NEXT PIN</span>
                <span className="font-mono text-[10px] bg-emerald-700 text-white px-1.5 py-0.5 rounded ml-auto">
                  Ctrl+Enter
                </span>
              </button>

              {/* Secondary actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleMarkManualRequired}
                  className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 py-2.5 px-3 rounded-xl border border-amber-200/80 dark:border-amber-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Manual Required</span>
                </button>
                <button
                  type="button"
                  onClick={handleMarkReady}
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] py-2.5 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                  <span>Mark Ready</span>
                </button>
              </div>

              {onRetryAiPin && (
                <button
                  type="button"
                  onClick={() => onRetryAiPin(currentPin)}
                  className="w-full text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 py-2.5 px-3 rounded-xl border border-purple-200/80 dark:border-purple-800 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Regenerate with Gemini AI</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Pin Metadata Breakdown & Field-by-field Copy */}
          <div 
            className={`${
              splitViewMode === 'hide-right'
                ? 'hidden'
                : splitViewMode === 'hide-left'
                ? 'lg:col-span-12'
                : splitRatio === '6-6'
                ? 'lg:col-span-6'
                : splitRatio === '4-8'
                ? 'lg:col-span-8'
                : 'lg:col-span-7'
            } space-y-5`}
          >
            {/* Left Panel Hidden Notice Banner (when in hide-left mode) */}
            {splitViewMode === 'hide-left' && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={currentPin.imageUrl} 
                    alt="" 
                    className="w-10 h-10 rounded-xl object-cover border border-amber-300 dark:border-amber-700 shrink-0" 
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      Left Image Panel Hidden (Full Width Editor Active)
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Editing Pin {currentIndex + 1} of {filteredPins.length}. Press <kbd className="font-mono bg-white dark:bg-white/[0.08] px-1 py-0.5 rounded border border-slate-200 dark:border-white/[0.08]">Alt + 1</kbd> or <kbd className="font-mono bg-white dark:bg-white/[0.08] px-1 py-0.5 rounded border border-slate-200 dark:border-white/[0.08]">Alt + S</kbd> to restore preview.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyImage}
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.08] px-3 py-1.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
                    title="Copy Pin Image to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-500" />
                    <span className="hidden sm:inline">Copy Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeSplitViewMode('split')}
                    className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-white dark:bg-white/[0.06] hover:bg-amber-50 dark:hover:bg-white/[0.1] border border-amber-200 dark:border-amber-800 px-3.5 py-1.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                    <span>Show Image (Alt+1)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter & Progress header */}
            <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 transition-colors amoled-card">
              {/* Filter by Status */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Filter:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as any);
                    setCurrentIndex(0);
                  }}
                  className="text-xs font-bold bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl p-2 text-slate-800 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="dark:bg-black text-slate-900 dark:text-white">All Pins ({pins.length})</option>
                  <option value="ready" className="dark:bg-black text-slate-900 dark:text-white">Ready ({readyCount})</option>
                  <option value="scheduled" className="dark:bg-black text-slate-900 dark:text-white">Scheduled ({scheduledCount})</option>
                  <option value="manual_required" className="dark:bg-black text-slate-900 dark:text-white">Manual Required ({manualCount})</option>
                  <option value="published" className="dark:bg-black text-slate-900 dark:text-white">Published ({publishedCount})</option>
                  <option value="failed" className="dark:bg-black text-slate-900 dark:text-white">Failed ({failedCount})</option>
                </select>
              </div>

              {/* Filter by Board */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Board:</span>
                <select
                  value={selectedBoardFilter}
                  onChange={(e) => {
                    setSelectedBoardFilter(e.target.value);
                    setCurrentIndex(0);
                  }}
                  className="text-xs font-bold bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl p-2 text-slate-800 dark:text-white focus:outline-none cursor-pointer max-w-[160px]"
                >
                  <option value="all" className="dark:bg-black text-slate-900 dark:text-white">All Boards</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id} className="dark:bg-black text-slate-900 dark:text-white">{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Progress bar and Hide Right Panel Button */}
              <div className="w-full sm:w-auto flex items-center gap-2 ml-auto">
                <div className="w-32 bg-slate-100 dark:bg-white/[0.08] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((publishedCount / Math.max(1, pins.length)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-400">
                  {publishedCount}/{pins.length} Published
                </span>

                {/* Hide Right Panel Button */}
                <button
                  type="button"
                  onClick={() => changeSplitViewMode('hide-right')}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer transition-colors ml-1"
                  title="Hide Details Panel for more Image space (Alt+2)"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Field Breakdown Cards */}
            <div className="space-y-4">
              {/* Title Field */}
              <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 shadow-xs transition-colors space-y-2 amoled-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">1. Pin Title</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {currentPin.title?.length || 0}/100 chars
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyField('Title', currentPin.title || '')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors ${
                      copiedField === 'Title'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {copiedField === 'Title' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'Title' ? 'Copied' : 'Copy Title'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={currentPin.title || ''}
                  onChange={(e) => {
                    onUpdatePin({
                      ...currentPin,
                      title: e.target.value,
                      titleManuallyEdited: true,
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                  placeholder="Enter Pinterest title..."
                  className="w-full text-sm font-semibold p-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Description Field */}
              <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 shadow-xs transition-colors space-y-2 amoled-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">2. Pin Description</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {currentPin.description?.length || 0}/500 chars
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyField('Description', currentPin.description || '')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors ${
                      copiedField === 'Description'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {copiedField === 'Description' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'Description' ? 'Copied' : 'Copy Description'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={currentPin.description || ''}
                  onChange={(e) => {
                    onUpdatePin({
                      ...currentPin,
                      description: e.target.value,
                      descriptionManuallyEdited: true,
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                  placeholder="Enter natural Pinterest description..."
                  className="w-full text-xs font-medium leading-relaxed p-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-y"
                />
              </div>

              {/* Alt Text Field (Visual Accessibility & SEO) */}
              <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 shadow-xs transition-colors space-y-2 amoled-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">3. Alt Text (Accessibility & Visual SEO)</span>
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-mono text-slate-400">
                      {currentPin.altText?.length || 0}/250 chars
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyField('Alt Text', currentPin.altText || '')}
                    disabled={!currentPin.altText}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 ${
                      copiedField === 'Alt Text'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {copiedField === 'Alt Text' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'Alt Text' ? 'Copied' : 'Copy Alt Text'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={250}
                  value={currentPin.altText || ''}
                  onChange={(e) => {
                    onUpdatePin({
                      ...currentPin,
                      altText: e.target.value,
                      altTextManuallyEdited: true,
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                  placeholder="Accurate visual description of what is physically visible in the image..."
                  className="w-full text-xs font-medium p-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Destination URL Field */}
              <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 shadow-xs transition-colors space-y-2 amoled-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">4. Destination URL</span>
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    {websites.length > 0 && (
                      <select
                        value={currentPin.websiteId || ''}
                        onChange={(e) => {
                          const wId = e.target.value;
                          const selectedSite = websites.find(w => w.id === wId);
                          onUpdatePin({
                            ...currentPin,
                            websiteId: wId || undefined,
                            destinationUrl: selectedSite ? selectedSite.url : currentPin.destinationUrl,
                            updatedAt: new Date().toISOString(),
                          });
                        }}
                        className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-xl px-2.5 py-1 focus:outline-none cursor-pointer"
                      >
                        <option value="" className="dark:bg-black text-slate-900 dark:text-white">⚡ Quick Link Website...</option>
                        {websites.map(w => (
                          <option key={w.id} value={w.id} className="dark:bg-black text-slate-900 dark:text-white">{w.name} ({w.url})</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyField('URL', currentPin.destinationUrl || '')}
                      disabled={!currentPin.destinationUrl}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 ${
                        copiedField === 'URL'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.1]'
                      }`}
                    >
                      {copiedField === 'URL' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'URL' ? 'Copied' : 'Copy URL'}</span>
                    </button>
                  </div>
                </div>
                <input
                  type="url"
                  value={currentPin.destinationUrl || ''}
                  onChange={(e) => {
                    onUpdatePin({
                      ...currentPin,
                      destinationUrl: e.target.value,
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                  placeholder="https://yourwebsite.com/post-link"
                  className="w-full text-xs font-mono p-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Tags Section (Chips) */}
              <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 shadow-xs transition-colors space-y-3 amoled-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">5. Tagged Topics (8-15 Tags)</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {currentPin.tags?.length || 0} topics
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] rounded-xl p-0.5 border border-slate-200 dark:border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => setTagFormat('comma')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                          tagFormat === 'comma' ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        Comma
                      </button>
                      <button
                        type="button"
                        onClick={() => setTagFormat('hashtag')}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                          tagFormat === 'hashtag' ? 'bg-white dark:bg-white/[0.12] text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        #Hashtag
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyField('Tags', getFormattedTags())}
                      disabled={!currentPin.tags || currentPin.tags.length === 0}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40 ${
                        copiedField === 'Tags'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-50 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.1]'
                      }`}
                    >
                      {copiedField === 'Tags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedField === 'Tags' ? 'Copied' : 'Copy All Tags'}</span>
                    </button>
                  </div>
                </div>

                {/* Chips */}
                {currentPin.tags && currentPin.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {currentPin.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        onClick={() => handleCopyField(`Tag "${tag}"`, tag)}
                        className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/[0.08] cursor-pointer transition-colors"
                        title="Click to copy single tag"
                      >
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-2">
                    No tags generated yet. Click "Regenerate with Gemini AI" to create 8-15 tags.
                  </div>
                )}
              </div>

              {/* Board & Scheduling Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Board Selection */}
                <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 shadow-xs transition-colors space-y-2 amoled-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">6. Target Board</span>
                    <button
                      type="button"
                      onClick={() => handleCopyField('Board', currentBoard?.name || '')}
                      disabled={!currentBoard}
                      className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Board</span>
                    </button>
                  </div>
                  <select
                    value={currentPin.boardId || ''}
                    onChange={(e) => {
                      onUpdatePin({
                        ...currentPin,
                        boardId: e.target.value || undefined,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="" className="dark:bg-black text-slate-900 dark:text-white">-- Select Target Board --</option>
                    {boards.map(b => (
                      <option key={b.id} value={b.id} className="dark:bg-black text-slate-900 dark:text-white">{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Scheduling info */}
                <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-5 shadow-xs transition-colors space-y-2 amoled-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">7. Scheduled Slot</span>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  {currentPin.scheduledAt ? (
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 shrink-0" />
                      <span>{new Date(currentPin.scheduledAt).toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 bg-slate-50 dark:bg-white/[0.04] p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08]">
                      Not scheduled (Publish on demand)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {/* Official Pinterest Bulk Export Section */}
      <BulkExportSection
        pins={pins}
        boards={boards}
        onOpenImportCsv={onOpenImportCsv}
        className="mt-6"
      />

      {/* Workflow Guide Modal */}
      {showWorkflowGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white/90 dark:bg-black/90 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] max-w-lg w-full p-6 space-y-5 shadow-2xl amoled-card">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#E60023]" />
                <span>30-Second Manual Publishing Workflow</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowWorkflowGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/[0.08]">
                <span className="w-6 h-6 rounded-full bg-[#E60023] text-white flex items-center justify-center font-bold shrink-0 text-[11px]">1</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-0.5">Open Pinterest & Upload Image</strong>
                  Click <code>[Open Pinterest Pin Builder]</code> then click <code>[Copy Image]</code> or <code>[Download Image]</code> to add it to Pinterest.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/[0.08]">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 text-[11px]">2</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-0.5">Copy Metadata in 1-Click</strong>
                  Click <code>[COPY ALL PIN METADATA]</code> (or <code>Ctrl+Shift+C</code>), or use individual copy buttons for Title, Description, Link, and Tags.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/[0.08]">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 text-[11px]">3</span>
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-0.5">Publish & Advance</strong>
                  Click Publish on Pinterest, then press <code>Ctrl+Enter</code> or click <code>[MARK PUBLISHED & NEXT]</code> to instantly advance!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowWorkflowGuide(false)}
              className="w-full bg-[#E60023] hover:bg-[#ad001a] text-white font-bold text-xs py-3 rounded-xl cursor-pointer transition-all active:scale-98"
            >
              Got it! Let's Publish
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white/90 dark:bg-black/90 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] max-w-md w-full p-6 space-y-5 shadow-2xl amoled-card">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Keyboard Shortcuts
              </h3>
              <button
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-transparent dark:border-white/[0.04]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Toggle Left Panel (Image Preview)</span>
                <kbd className="font-mono text-[11px] bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  Alt + 1
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-transparent dark:border-white/[0.04]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Toggle Right Panel (Metadata Editor)</span>
                <kbd className="font-mono text-[11px] bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  Alt + 2
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-transparent dark:border-white/[0.04]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Reset Split View (Both Panels)</span>
                <kbd className="font-mono text-[11px] bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  Alt + S
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-transparent dark:border-white/[0.04]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Next Pin</span>
                <kbd className="font-mono text-[11px] bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  Alt + →
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-transparent dark:border-white/[0.04]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Previous Pin</span>
                <kbd className="font-mono text-[11px] bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  Alt + ←
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-transparent dark:border-white/[0.04]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Copy All Pin Metadata</span>
                <kbd className="font-mono text-[11px] bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  Ctrl + Shift + C
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-transparent dark:border-white/[0.04]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Mark Published & Next Pin</span>
                <kbd className="font-mono text-[11px] bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  Ctrl + Enter
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-transparent dark:border-white/[0.04]">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Open Pinterest</span>
                <kbd className="font-mono text-[11px] bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white px-2 py-1 rounded border border-slate-200 dark:border-white/[0.08] shadow-xs">
                  Alt + P
                </kbd>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShortcutsHelp(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs py-3 rounded-xl cursor-pointer transition-all active:scale-98"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
