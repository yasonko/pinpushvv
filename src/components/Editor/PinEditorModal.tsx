import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Globe, 
  FolderHeart, 
  Send, 
  Trash2, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  Tag,
  AlertCircle,
  RotateCw,
  Edit3,
  Calendar,
  Plus,
  Copy,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Columns,
  Layout
} from 'lucide-react';
import { Pin, Board, Website, AiStatus, PinKeywordDetail, KeywordValidationSummary } from '../../types';
import { aiMetadataQueue } from '../../services/aiMetadataEngine';
import { 
  copyToClipboard, 
  downloadPinImageFile, 
  openPinterestPinBuilder, 
  formatSinglePin 
} from '../../services/clipboardHelper';
import { sanitizeTag, sanitizeTagList, formatTagsForPinterest } from '../../services/tagsHelper';
import { TagChips } from '../Tags/TagChips';
import { PinterestKeywordValidatorUI } from '../Tags/PinterestKeywordValidatorUI';
import { PinCopyModal } from '../Clipboard/PinCopyModal';

interface PinEditorModalProps {
  pin: Pin | null;
  allPins: Pin[];
  boards: Board[];
  websites: Website[];
  timezone: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (pin: Pin) => void;
  onPublish: (pin: Pin) => void;
  onDelete: (id: string) => void;
  onSelectPin: (pin: Pin) => void;
  language?: string;
}

export const PinEditorModal: React.FC<PinEditorModalProps> = ({
  pin,
  allPins,
  boards,
  websites,
  timezone,
  isOpen,
  onClose,
  onSave,
  onPublish,
  onDelete,
  onSelectPin,
  language = 'English',
}) => {
  // Split View Panel Collapse Mode
  const [editorSplitMode, setEditorSplitMode] = useState<'split' | 'hide-preview' | 'hide-form'>('split');

  // Local state for editing fields
  const [title, setTitle] = useState(pin?.title || '');
  const [description, setDescription] = useState(pin?.description || '');
  const [destinationUrl, setDestinationUrl] = useState(pin?.destinationUrl || '');
  const [altText, setAltText] = useState(pin?.altText || '');
  const [tags, setTags] = useState<string[]>(pin?.tags || []);
  const [keywordDetails, setKeywordDetails] = useState<PinKeywordDetail[]>(pin?.keywordDetails || []);
  const [keywordSummary, setKeywordSummary] = useState<KeywordValidationSummary | undefined>(pin?.keywordSummary);
  const [newTagInput, setNewTagInput] = useState('');
  const [boardId, setBoardId] = useState(pin?.boardId || '');
  const [websiteId, setWebsiteId] = useState(pin?.websiteId || '');
  const [scheduledAt, setScheduledAt] = useState(pin?.scheduledAt || '');
  
  // Manual edit flags
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(pin?.titleManuallyEdited || false);
  const [descriptionManuallyEdited, setDescriptionManuallyEdited] = useState(pin?.descriptionManuallyEdited || false);
  const [altTextManuallyEdited, setAltTextManuallyEdited] = useState(pin?.altTextManuallyEdited || false);
  const [tagsManuallyEdited, setTagsManuallyEdited] = useState(pin?.tagsManuallyEdited || false);

  // Custom AI Guidance / Prompt state
  const [customPrompt, setCustomPrompt] = useState(pin?.aiCustomPrompt || '');

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegeneratingDesc, setIsRegeneratingDesc] = useState(false);
  const [isRegeneratingAlt, setIsRegeneratingAlt] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  const triggerCopy = async (text: string, fieldName: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Sync state whenever pin changes
  useEffect(() => {
    if (!pin) return;
    setTitle(pin.title || '');
    setDescription(pin.description || '');
    setDestinationUrl(pin.destinationUrl || '');
    setAltText(pin.altText || '');
    setTags(pin.tags || []);
    setKeywordDetails(pin.keywordDetails || []);
    setKeywordSummary(pin.keywordSummary);
    setBoardId(pin.boardId || '');
    setWebsiteId(pin.websiteId || '');
    setScheduledAt(pin.scheduledAt || '');
    setTitleManuallyEdited(pin.titleManuallyEdited || false);
    setDescriptionManuallyEdited(pin.descriptionManuallyEdited || false);
    setAltTextManuallyEdited(pin.altTextManuallyEdited || false);
    setTagsManuallyEdited(pin.tagsManuallyEdited || false);
    setCustomPrompt(pin.aiCustomPrompt || '');
    setIsRegenerating(pin.aiStatus === 'processing');
  }, [pin]);

  const currentIndex = pin ? allPins.findIndex((p) => p.id === pin.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allPins.length - 1;

  const handlePrev = () => {
    if (hasPrev) onSelectPin(allPins[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext) onSelectPin(allPins[currentIndex + 1]);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && (e.metaKey || e.altKey)) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight' && (e.metaKey || e.altKey)) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, allPins, isOpen]);

  const handleSave = () => {
    if (!pin) return;
    const now = new Date().toISOString();
    const updatedPin: Pin = {
      ...pin,
      title,
      description,
      destinationUrl,
      altText,
      tags,
      keywordDetails,
      keywordSummary,
      aiCustomPrompt: customPrompt,
      boardId: boardId || undefined,
      websiteId: websiteId || undefined,
      scheduledAt: scheduledAt || null,
      status: scheduledAt ? 'scheduled' : pin.status === 'scheduled' ? 'draft' : pin.status,
      titleManuallyEdited,
      descriptionManuallyEdited,
      altTextManuallyEdited,
      tagsManuallyEdited,
      updatedAt: now,
    };
    onSave(updatedPin);
    onClose();
  };

  // AI Single Pin Regeneration (All Fields)
  const handleRegenerateMetadata = async () => {
    setIsRegenerating(true);
    try {
      const regenerated = await aiMetadataQueue.processSinglePin(
        { ...pin, aiCustomPrompt: customPrompt },
        language,
        (updated) => {
          if (updated.id === pin.id) {
            setTitle(updated.title);
            setDescription(updated.description);
            setAltText(updated.altText || '');
            setTags(updated.tags || []);
            setKeywordDetails(updated.keywordDetails || []);
            setKeywordSummary(updated.keywordSummary);
            setTitleManuallyEdited(false);
            setDescriptionManuallyEdited(false);
            setAltTextManuallyEdited(false);
            setTagsManuallyEdited(false);
            onSave(updated);
          }
        },
        customPrompt
      );

      setTitle(regenerated.title);
      setDescription(regenerated.description);
      setAltText(regenerated.altText || '');
      setTags(regenerated.tags || []);
      setKeywordDetails(regenerated.keywordDetails || []);
      setKeywordSummary(regenerated.keywordSummary);
      setTitleManuallyEdited(false);
      setDescriptionManuallyEdited(false);
      setAltTextManuallyEdited(false);
      setTagsManuallyEdited(false);
    } catch (err) {
      console.error('Failed to regenerate metadata:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // AI Single Field: Description Regeneration
  const handleRegenerateDescription = async () => {
    setIsRegeneratingDesc(true);
    try {
      const regenerated = await aiMetadataQueue.processSinglePin(
        {
          ...pin,
          title,
          tags,
          altText,
          destinationUrl,
          titleManuallyEdited: true, // Keep title
          tagsManuallyEdited: true, // Keep tags
          altTextManuallyEdited: true, // Keep alt text
          descriptionManuallyEdited: false, // Force re-generate description
          aiCustomPrompt: customPrompt,
        },
        language,
        undefined,
        customPrompt
      );
      if (regenerated.description) {
        setDescription(regenerated.description);
        setDescriptionManuallyEdited(false);
      }
    } catch (err) {
      console.error('Failed to regenerate description:', err);
    } finally {
      setIsRegeneratingDesc(false);
    }
  };

  // AI Single Field: Alt Text Regeneration
  const handleRegenerateAltText = async () => {
    setIsRegeneratingAlt(true);
    try {
      const regenerated = await aiMetadataQueue.processSinglePin(
        {
          ...pin,
          title,
          description,
          tags,
          destinationUrl,
          titleManuallyEdited: true,
          descriptionManuallyEdited: true,
          tagsManuallyEdited: true,
          altTextManuallyEdited: false, // Force re-generate alt text
          aiCustomPrompt: customPrompt,
        },
        language,
        undefined,
        customPrompt
      );
      if (regenerated.altText) {
        setAltText(regenerated.altText);
        setAltTextManuallyEdited(false);
      }
    } catch (err) {
      console.error('Failed to regenerate alt text:', err);
    } finally {
      setIsRegeneratingAlt(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ',') return;
    e.preventDefault();
    const clean = sanitizeTag(newTagInput);
    if (clean && !tags.includes(clean)) {
      const updated = [...tags, clean];
      setTags(updated);
      setTagsManuallyEdited(true);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (index: number) => {
    const updated = tags.filter((_, i) => i !== index);
    setTags(updated);
    setTagsManuallyEdited(true);
  };

  const handleWebsiteChange = (wId: string) => {
    setWebsiteId(wId);
    if (wId) {
      const selectedSite = websites.find(w => w.id === wId);
      if (selectedSite && (!destinationUrl || destinationUrl === '')) {
        setDestinationUrl(selectedSite.url);
      }
    }
  };

  const getAiBadge = (status: AiStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            <Check className="w-3 h-3 text-emerald-600" /> AI Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-[#E60023] border border-red-200 text-[11px] font-bold animate-pulse">
            <RotateCw className="w-3 h-3 animate-spin" /> AI Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
            <AlertCircle className="w-3 h-3 text-rose-600" /> AI Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold">
            <Sparkles className="w-3 h-3 text-slate-400" /> AI Pending
          </span>
        );
    }
  };

  if (!isOpen || !pin) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col transition-colors">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#F7F7F9] dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!hasPrev}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer shadow-sm"
                title="Previous Pin (Alt+Left)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!hasNext}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer shadow-sm"
                title="Next Pin (Alt+Right)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800" />

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                  {pin.filename}
                </h3>
                {getAiBadge(pin.aiStatus)}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                Pin {currentIndex + 1} of {allPins.length} • Status: {pin.status.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Split View Panel Toggle Controls */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-300/60 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEditorSplitMode(editorSplitMode === 'hide-preview' ? 'split' : 'hide-preview')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  editorSplitMode === 'hide-preview'
                    ? 'bg-white dark:bg-slate-700 text-[#E60023] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title={editorSplitMode === 'hide-preview' ? 'Show Preview (Split View)' : 'Hide Image Preview for Full Width Editor'}
              >
                {editorSplitMode === 'hide-preview' ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setEditorSplitMode('split')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  editorSplitMode === 'split'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="Split View (Side by Side)"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditorSplitMode(editorSplitMode === 'hide-form' ? 'split' : 'hide-form')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  editorSplitMode === 'hide-form'
                    ? 'bg-white dark:bg-slate-700 text-[#E60023] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title={editorSplitMode === 'hide-form' ? 'Show Form (Split View)' : 'Hide Form for Full Image Cockpit'}
              >
                {editorSplitMode === 'hide-form' ? <PanelRightOpen className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Direct Copy Pin Details Button */}
            <button
              type="button"
              onClick={() => setIsCopyModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl cursor-pointer shadow-sm transition-colors"
              title="Copy Pin details or format to paste into Pinterest"
            >
              <Copy className="w-3.5 h-3.5 text-[#E60023] dark:text-red-400" />
              <span className="hidden sm:inline">Copy for Pinterest</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDelete(pin.id);
                onClose();
              }}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
              title="Delete Pin"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content: 2-Column Bento Layout */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Left Column: Image Preview + Metadata Quick Actions */}
          <div 
            className={`${
              editorSplitMode === 'hide-preview' 
                ? 'hidden' 
                : editorSplitMode === 'hide-form' 
                ? 'lg:col-span-12' 
                : 'lg:col-span-5'
            } p-6 bg-[#F7F7F9] dark:bg-slate-950 space-y-4 flex flex-col justify-between`}
          >
            {/* Form Hidden Alert Banner */}
            {editorSplitMode === 'hide-form' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Form Panel Hidden (Viewing Full Image)
                </span>
                <button
                  type="button"
                  onClick={() => setEditorSplitMode('split')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 cursor-pointer flex items-center gap-1"
                >
                  <PanelRightOpen className="w-3.5 h-3.5" />
                  <span>Restore Form</span>
                </button>
              </div>
            )}

            <div className="space-y-4">
              {/* Image Preview */}
              <div className={`relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm aspect-[2/3] ${editorSplitMode === 'hide-form' ? 'max-h-[600px]' : 'max-h-[460px]'} mx-auto flex items-center justify-center group`}>
                <img
                  src={pin.imageUrl}
                  alt={title || pin.filename}
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                />

                {isRegenerating ? (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 text-center space-y-2">
                    <Sparkles className="w-8 h-8 text-[#E60023] animate-spin" />
                    <span className="text-xs font-bold font-mono">Gemini analyzing visual...</span>
                  </div>
                ) : null}
              </div>

              {/* Pin Error Pill if failed */}
              {pin.aiError ? (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-bold">AI Analysis Notice:</span>
                    <p className="text-[11px] mt-0.5">{pin.aiError}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Action Buttons in Left Column */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRegenerateMetadata}
                disabled={isRegenerating}
                className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold py-2.5 rounded-2xl cursor-pointer transition-colors shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-[#E60023] dark:text-red-400" />
                <span>{isRegenerating ? 'Analyzing Image...' : 'Regenerate AI Metadata'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 text-[#E60023] dark:text-red-300 text-xs font-bold py-2 rounded-xl cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Pin Set</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadPinImageFile(pin)}
                  className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold py-2 rounded-xl cursor-pointer transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Editable Metadata Fields */}
          <div 
            className={`${
              editorSplitMode === 'hide-form' 
                ? 'hidden' 
                : editorSplitMode === 'hide-preview' 
                ? 'lg:col-span-12' 
                : 'lg:col-span-7'
            } p-6 space-y-5 bg-white dark:bg-slate-900`}
          >
            {/* Preview Hidden Alert Banner */}
            {editorSplitMode === 'hide-preview' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Preview Panel Hidden (Wide Editor Mode Active)
                </span>
                <button
                  type="button"
                  onClick={() => setEditorSplitMode('split')}
                  className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-800 hover:bg-amber-50 cursor-pointer flex items-center gap-1"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                  <span>Restore Preview</span>
                </button>
              </div>
            )}

            {/* Custom AI Prompt & Guidance Field */}
            <div className="p-4 bg-gradient-to-br from-red-50/60 via-rose-50/30 to-slate-50 dark:from-red-950/20 dark:via-rose-950/10 dark:to-slate-900 rounded-2xl border border-red-200/80 dark:border-red-900/50 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
                  <span>AI Prompt / Topic Guidance (يبني عليها العنوان والوصف)</span>
                </label>
                <div className="flex items-center gap-2">
                  {customPrompt && (
                    <button
                      type="button"
                      onClick={() => setCustomPrompt('')}
                      className="text-[11px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    Custom Context
                  </span>
                </div>
              </div>

              <textarea
                rows={2}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="اكتب هنا ما تريد أن يبني عليه الذكاء الاصطناعي (مثال: أسلوب جذاب، التركيز على أفكار الديكور، نصائح عملية، كلمات مفتاحية معينة)..."
                className="w-full text-xs font-normal p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 resize-y leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400">Quick ideas:</span>
                  {[
                    'Modern Aesthetic',
                    'Budget DIY Tips',
                    'Viral Pinterest Hook',
                    'Step-by-Step Guide',
                  ].map((idea, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCustomPrompt(prev => prev ? `${prev.trim()}, ${idea}` : idea)}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#E60023] dark:hover:text-red-400 cursor-pointer transition-colors"
                    >
                      + {idea}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleRegenerateMetadata}
                  disabled={isRegenerating}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#E60023] hover:bg-[#ad001a] disabled:opacity-50 px-3 py-1.5 rounded-xl cursor-pointer shadow-xs transition-all"
                  title="Generate or regenerate title, description, and tags based on this prompt"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                  <span>{isRegenerating ? 'Generating...' : 'Apply & Regenerate'}</span>
                </button>
              </div>
            </div>

            {/* Destination URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  Destination URL
                </label>
                <div className="flex items-center gap-2">
                  {websites.length > 0 && (
                    <select
                      value={websiteId}
                      onChange={(e) => handleWebsiteChange(e.target.value)}
                      className="text-[11px] font-bold text-[#E60023] dark:text-red-400 bg-transparent border-0 focus:outline-none cursor-pointer hover:underline"
                    >
                      <option value="" className="dark:bg-slate-900 text-slate-700 dark:text-slate-200">
                        ⚡ Quick Fill from Website...
                      </option>
                      {websites.map((w) => (
                        <option key={w.id} value={w.id} className="dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                          {w.name} ({w.url})
                        </option>
                      ))}
                    </select>
                  )}
                  {destinationUrl && (
                    <button
                      type="button"
                      onClick={() => triggerCopy(destinationUrl, 'url')}
                      className="text-[11px] font-bold text-[#E60023] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'url' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'url' ? 'Copied URL!' : 'Copy URL'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://yourwebsite.com/article-slug"
                  className="flex-1 text-xs font-mono p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
                />
                {destinationUrl ? (
                  <a
                    href={destinationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center"
                    title="Test URL"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  Pinterest Title
                </label>
                <div className="flex items-center gap-2">
                  {title && (
                    <button
                      type="button"
                      onClick={() => triggerCopy(title, 'title')}
                      className="text-[11px] font-bold text-[#E60023] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'title' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'title' ? 'Copied Title!' : 'Copy Title'}</span>
                    </button>
                  )}
                  {titleManuallyEdited ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                      Manual Edit
                    </span>
                  ) : null}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {title.length}/100
                  </span>
                </div>
              </div>
              <input
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleManuallyEdited(true);
                }}
                placeholder="Catchy, descriptive Pinterest title..."
                className="w-full text-xs font-semibold p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Pinterest Description
                  <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">(Traffic-Focused)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerateDescription}
                    disabled={isRegeneratingDesc || isRegenerating}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E60023] dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-800/60 cursor-pointer disabled:opacity-50 transition-colors"
                    title="Regenerate only the traffic-focused description with a natural website CTA"
                  >
                    <Sparkles className={`w-3 h-3 ${isRegeneratingDesc ? 'animate-spin' : ''}`} />
                    <span>{isRegeneratingDesc ? 'Regenerating...' : 'Regenerate Description'}</span>
                  </button>

                  {description && (
                    <button
                      type="button"
                      onClick={() => {
                        let text = description;
                        if (tags && tags.length > 0) {
                          const tagBlock = tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ');
                          text = `${text}\n\n${tagBlock}`;
                        }
                        triggerCopy(text, 'desc');
                      }}
                      className="text-[11px] font-bold text-[#E60023] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'desc' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'desc' ? 'Copied Desc!' : 'Copy Description'}</span>
                    </button>
                  )}
                  {descriptionManuallyEdited ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                      Manual Edit
                    </span>
                  ) : null}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {description.length}/500
                  </span>
                </div>
              </div>
              <textarea
                rows={3}
                maxLength={500}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescriptionManuallyEdited(true);
                }}
                placeholder="Traffic-focused Pinterest description with curiosity hook, keywords, and natural website CTA..."
                className="w-full text-xs p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023] leading-relaxed"
              />
            </div>

            {/* Alt Text (Visual Accessibility) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Alt Text
                  <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">(Accessibility & Visual SEO)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerateAltText}
                    disabled={isRegeneratingAlt || isRegenerating}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50 transition-colors"
                    title="Regenerate objective visual alt text without sales CTA"
                  >
                    <Sparkles className={`w-3 h-3 ${isRegeneratingAlt ? 'animate-spin' : ''}`} />
                    <span>{isRegeneratingAlt ? 'Regenerating...' : 'Regenerate Alt'}</span>
                  </button>

                  {altText && (
                    <button
                      type="button"
                      onClick={() => triggerCopy(altText, 'altText')}
                      className="text-[11px] font-bold text-[#E60023] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'altText' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'altText' ? 'Copied Alt!' : 'Copy Alt'}</span>
                    </button>
                  )}
                  {altTextManuallyEdited ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                      Manual Edit
                    </span>
                  ) : null}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {altText.length}/250
                  </span>
                </div>
              </div>
              <input
                type="text"
                maxLength={250}
                value={altText}
                onChange={(e) => {
                  setAltText(e.target.value);
                  setAltTextManuallyEdited(true);
                }}
                placeholder="Accurate visual description of what is physically visible in the image..."
                className="w-full text-xs p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
            </div>

            {/* Pinterest Smart Tags & Keywords Validation System */}
            <PinterestKeywordValidatorUI
              pin={{
                ...pin,
                title,
                description,
                altText,
                destinationUrl,
                tags,
                keywordDetails,
                keywordSummary,
              }}
              tags={tags}
              keywordDetails={keywordDetails}
              keywordSummary={keywordSummary}
              language={language}
              onChange={(newTags, newDetails, summary) => {
                setTags(newTags);
                if (newDetails) setKeywordDetails(newDetails);
                if (summary) setKeywordSummary(summary);
                setTagsManuallyEdited(true);
              }}
            />

            {/* Board & Website Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FolderHeart className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  Pinterest Board
                </label>
                <select
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
                >
                  <option value="">Select Board...</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  Linked Website
                </label>
                <select
                  value={websiteId}
                  onChange={(e) => handleWebsiteChange(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
                >
                  <option value="">Select Website...</option>
                  {websites.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Schedule Date/Time */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                Schedule Publishing ({timezone})
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="datetime-local"
                  value={scheduledAt ? new Date(scheduledAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScheduledAt(val ? new Date(val).toISOString() : '');
                  }}
                  className="flex-1 text-xs font-mono p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
                />
                {scheduledAt ? (
                  <button
                    type="button"
                    onClick={() => setScheduledAt('')}
                    className="text-xs text-rose-500 dark:text-rose-400 font-bold hover:underline px-2 cursor-pointer"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCopyModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-[#E60023] dark:text-red-400" />
              <span>Copy for Pinterest</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date().toISOString();
                const updatedPin: Pin = {
                  ...pin,
                  title,
                  description,
                  destinationUrl,
                  altText,
                  tags,
                  boardId: boardId || undefined,
                  websiteId: websiteId || undefined,
                  scheduledAt: scheduledAt || null,
                  status: scheduledAt ? 'scheduled' : pin.status === 'scheduled' ? 'draft' : pin.status,
                  titleManuallyEdited,
                  descriptionManuallyEdited,
                  tagsManuallyEdited,
                  updatedAt: now,
                };
                onSave(updatedPin);
                onPublish(updatedPin);
                onClose();
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-[#E60023] dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish Now</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#E60023] hover:bg-[#ad001a] px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200 dark:shadow-none"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Pin Copy Modal */}
      {isCopyModalOpen && (
        <PinCopyModal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          pins={[{
            ...pin,
            title,
            description,
            destinationUrl,
            altText,
            tags,
            boardId: boardId || undefined,
          }]}
          boards={boards}
        />
      )}
    </div>
  );
};
