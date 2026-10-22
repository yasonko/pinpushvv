import React, { useState, useMemo } from 'react';
import { 
  Check, 
  RotateCw, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Layers, 
  CalendarClock, 
  Send, 
  Grid3X3, 
  Table as TableIcon,
  CheckSquare,
  Square,
  Stamp,
  Crop,
  Globe,
  Download,
  Plus,
  ArrowUpDown,
  SlidersHorizontal,
  Copy,
  Shuffle,
  FileSpreadsheet
} from 'lucide-react';
import { Pin, Board, Website } from '../../types';
import { FastTableView } from './FastTableView';
import { formatTagsForPinterest } from '../../services/tagsHelper';
import { PinCopyModal } from '../Clipboard/PinCopyModal';
import { UrlSplitDistributionModal } from '../Tools/UrlSplitDistributionModal';
import { BulkExportSection } from '../Bulk/BulkExportSection';
import { downloadPinterestCSV } from '../../services/csvEngine';

interface PinLibraryViewProps {
  pins: Pin[];
  boards: Board[];
  websites: Website[];
  searchQuery: string;
  onUpdatePin: (pin: Pin) => void;
  onDeletePins: (ids: string[]) => void;
  onEditPin: (pin: Pin) => void;
  onRetryAiPin?: (pin: Pin) => void;
  onOpenBulkEdit: (targetPins: Pin[]) => void;
  onOpenAutoSchedule: (targetPins: Pin[]) => void;
  onOpenWatermark: (targetPins?: Pin[]) => void;
  onOpenAspectRatio: (targetPins?: Pin[]) => void;
  onOpenUtmBuilder: (targetPins?: Pin[]) => void;
  onOpenAiConfirm: (targetPins: Pin[]) => void;
  onDownloadZip: (targetPins: Pin[]) => void;
  onPublishPins: (targetPins: Pin[]) => void;
  onOpenUpload: () => void;
  onOpenAssistant?: (pinId?: string) => void;
  onOpenImportCsv?: () => void;
  onOpenBulkExport?: (targetPins?: Pin[]) => void;
  onPinsUpdated?: (updatedPins: Pin[]) => void;
  language?: string;
}

export type SortOption = 'date_desc' | 'date_asc' | 'title_asc' | 'title_desc' | 'filename_asc' | 'scheduled_asc';

export const PinLibraryView: React.FC<PinLibraryViewProps> = ({
  pins,
  boards,
  websites,
  searchQuery,
  onUpdatePin,
  onDeletePins,
  onEditPin,
  onRetryAiPin,
  onOpenBulkEdit,
  onOpenAutoSchedule,
  onOpenWatermark,
  onOpenAspectRatio,
  onOpenUtmBuilder,
  onOpenAiConfirm,
  onDownloadZip,
  onPublishPins,
  onOpenUpload,
  onOpenAssistant,
  onOpenImportCsv,
  onOpenBulkExport,
  onPinsUpdated,
  language = 'English',
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [aiFilter, setAiFilter] = useState<string>('all');
  const [boardFilter, setBoardFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [selectedPinIds, setSelectedPinIds] = useState<Set<string>>(new Set());
  const [copyTargetPins, setCopyTargetPins] = useState<Pin[] | null>(null);
  const [isUrlSplitModalOpen, setIsUrlSplitModalOpen] = useState(false);

  // Filter & Sort Pins
  const filteredPins = useMemo(() => {
    const list = pins.filter((pin) => {
      // Status filter
      if (statusFilter !== 'all' && pin.status !== statusFilter) return false;

      // AI Status filter
      if (aiFilter !== 'all') {
        if (aiFilter === 'waiting' && pin.aiStatus !== 'waiting' && pin.aiStatus !== 'pending') return false;
        if (aiFilter === 'analyzing' && pin.aiStatus !== 'analyzing' && pin.aiStatus !== 'processing' && pin.aiStatus !== 'retrying') return false;
        if (aiFilter === 'success' && pin.aiStatus !== 'success' && pin.aiStatus !== 'completed') return false;
        if (aiFilter === 'failed' && pin.aiStatus !== 'failed') return false;
      }

      // Board filter
      if (boardFilter !== 'all' && pin.boardId !== boardFilter) return false;

      // Search Query
      if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = (pin.title || '').toLowerCase().includes(q);
        const matchesFilename = (pin.filename || '').toLowerCase().includes(q);
        const matchesUrl = (pin.destinationUrl || '').toLowerCase().includes(q);
        const matchesDesc = (pin.description || '').toLowerCase().includes(q);
        const matchesTag = Array.isArray(pin.tags) ? pin.tags.some(t => String(t || '').toLowerCase().includes(q)) : false;
        if (!matchesTitle && !matchesFilename && !matchesUrl && !matchesDesc && !matchesTag) return false;
      }

      return true;
    });

    // Apply Sorting
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'date_desc': // Newest first
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'date_asc': // Oldest first
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'title_asc': // Name A to Z
          return (a.title || a.filename || '').localeCompare(b.title || b.filename || '');
        case 'title_desc': // Name Z to A
          return (b.title || b.filename || '').localeCompare(a.title || a.filename || '');
        case 'filename_asc': // Filename A to Z
          return (a.filename || '').localeCompare(b.filename || '');
        case 'scheduled_asc': // Scheduled date soonest
          if (!a.scheduledAt && !b.scheduledAt) return 0;
          if (!a.scheduledAt) return 1;
          if (!b.scheduledAt) return -1;
          return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        default:
          return 0;
      }
    });
  }, [pins, statusFilter, aiFilter, boardFilter, searchQuery, sortBy]);

  // Selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedPinIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPinIds(next);
  };

  const selectAll = () => {
    if (selectedPinIds.size === filteredPins.length) {
      setSelectedPinIds(new Set());
    } else {
      setSelectedPinIds(new Set(filteredPins.map(p => p.id)));
    }
  };

  const selectedPins = useMemo(() => {
    return pins.filter(p => selectedPinIds.has(p.id));
  }, [pins, selectedPinIds]);

  const handleDeleteSelected = () => {
    if (selectedPinIds.size === 0) return;
    onDeletePins(Array.from(selectedPinIds));
    setSelectedPinIds(new Set());
  };

  const targetBatch = selectedPins.length > 0 ? selectedPins : filteredPins;
  const pendingAiCount = targetBatch.filter(p => p.aiStatus === 'waiting' || p.aiStatus === 'pending' || p.aiStatus === 'failed').length;

  const getAiBadge = (pin: Pin) => {
    switch (pin.aiStatus) {
      case 'success':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[9px] font-bold shadow-sm" title="AI Metadata generated successfully">
            <Check className="w-2.5 h-2.5" /> Success
          </span>
        );
      case 'analyzing':
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[9px] font-bold animate-pulse shadow-sm" title="Analyzing image with Gemini Vision">
            <RotateCw className="w-2.5 h-2.5 animate-spin" /> Analyzing
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[9px] font-bold shadow-sm" title={`Retrying AI analysis (Attempt ${pin.aiRetryAttempt || 1})`}>
            <RotateCw className="w-2.5 h-2.5 animate-spin" /> Retrying
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-[9px] font-bold shadow-sm" title={pin.aiError || 'AI Analysis failed. Click Retry.'}>
            <AlertCircle className="w-2.5 h-2.5" /> Failed
          </span>
        );
      case 'waiting':
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-[9px] font-bold shadow-sm" title="Waiting in AI analysis queue">
            <Clock className="w-2.5 h-2.5 text-slate-300" /> Waiting
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Filter & Actions Bento Card */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-4 rounded-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-colors amoled-card">
        {/* Left: Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-50 dark:bg-white/[0.03] p-1 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'ready', label: 'Ready' },
              { id: 'manual_required', label: 'Manual Required' },
              { id: 'draft', label: 'Drafts' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'published', label: 'Published' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-white/[0.1] text-[#E60023] dark:text-white font-bold shadow-2xs border border-transparent dark:border-white/[0.08]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* AI Status Filter Selector */}
          <select
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value)}
            className="text-xs font-medium py-2 px-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#E60023] cursor-pointer"
          >
            <option value="all" className="dark:bg-black text-slate-900 dark:text-white">AI: All Statuses</option>
            <option value="waiting" className="dark:bg-black text-slate-900 dark:text-white">AI: Waiting ({pins.filter(p => p.aiStatus === 'waiting' || p.aiStatus === 'pending').length})</option>
            <option value="analyzing" className="dark:bg-black text-slate-900 dark:text-white">AI: Analyzing ({pins.filter(p => p.aiStatus === 'analyzing' || p.aiStatus === 'processing' || p.aiStatus === 'retrying').length})</option>
            <option value="success" className="dark:bg-black text-slate-900 dark:text-white">AI: Success ({pins.filter(p => p.aiStatus === 'success' || p.aiStatus === 'completed').length})</option>
            <option value="failed" className="dark:bg-black text-slate-900 dark:text-white">AI: Failed ({pins.filter(p => p.aiStatus === 'failed').length})</option>
          </select>

          {/* Board Selector */}
          <select
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value)}
            className="text-xs font-medium py-2 px-3 bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#E60023] cursor-pointer"
          >
            <option value="all" className="dark:bg-black text-slate-900 dark:text-white">All Boards ({boards.length})</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id} className="dark:bg-black text-slate-900 dark:text-white">
                {b.name}
              </option>
            ))}
          </select>

          {/* SORT BY SELECTOR (Date & Name) */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/[0.04] p-1 pl-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs font-bold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer py-1 pr-2"
            >
              <option value="date_desc" className="dark:bg-black text-slate-900 dark:text-white">Sort: Date (Newest)</option>
              <option value="date_asc" className="dark:bg-black text-slate-900 dark:text-white">Sort: Date (Oldest)</option>
              <option value="title_asc" className="dark:bg-black text-slate-900 dark:text-white">Sort: Name (A → Z)</option>
              <option value="title_desc" className="dark:bg-black text-slate-900 dark:text-white">Sort: Name (Z → A)</option>
              <option value="filename_asc" className="dark:bg-black text-slate-900 dark:text-white">Sort: Filename (A → Z)</option>
              <option value="scheduled_asc" className="dark:bg-black text-slate-900 dark:text-white">Sort: Schedule Date</option>
            </select>
          </div>
        </div>

        {/* Right: View mode & Select All */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Trigger for AI Generation */}
          <button
            type="button"
            onClick={() => onOpenAiConfirm(targetBatch)}
            className="flex items-center gap-1.5 text-xs font-bold text-[#E60023] dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800/60 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Generate {selectedPinIds.size > 0 ? `(${selectedPinIds.size})` : `(${pendingAiCount})`}</span>
          </button>

          {/* Select All Toggle */}
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] px-3.5 py-2 rounded-xl cursor-pointer transition-all active:scale-95"
          >
            {selectedPinIds.size > 0 && selectedPinIds.size === filteredPins.length ? (
              <CheckSquare className="w-4 h-4 text-[#E60023]" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {selectedPinIds.size > 0
                ? `Selected (${selectedPinIds.size})`
                : `Select All (${filteredPins.length})`}
            </span>
          </button>

          {/* Switch Grid / Table View */}
          <div className="flex items-center bg-slate-50 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-2xs' 
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                viewMode === 'table' 
                  ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-white shadow-2xs' 
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="Fast Dense Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar when items selected */}
      {selectedPinIds.size > 0 ? (
        <div className="bg-slate-900/90 dark:bg-black/90 dark:backdrop-blur-2xl text-white px-5 py-3 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border border-slate-750 dark:border-white/[0.1] amoled-card">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold font-mono text-slate-300">
              {selectedPinIds.size} Selected
            </span>
            <span className="h-4 w-[1px] bg-slate-700 dark:bg-white/[0.1]" />

            <button
              type="button"
              onClick={() => onOpenAiConfirm(selectedPins)}
              className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer bg-[#E60023] hover:bg-[#ad001a] px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Generate Metadata
            </button>

            {onOpenAssistant && (
              <button
                type="button"
                onClick={() => onOpenAssistant(selectedPins[0]?.id)}
                className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" /> Launch Assistant ({selectedPins.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsUrlSplitModalOpen(true)}
              className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
              title="Split or link website URLs across selected pins"
            >
              <Globe className="w-3.5 h-3.5 text-rose-400" /> Split / Link URLs
            </button>
            <button
              type="button"
              onClick={() => onOpenBulkEdit(selectedPins)}
              className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
            >
              <Layers className="w-3.5 h-3.5 text-red-400" /> Edit Metadata
            </button>
            <button
              type="button"
              onClick={() => onOpenAutoSchedule(selectedPins)}
              className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
            >
              <CalendarClock className="w-3.5 h-3.5 text-blue-400" /> Auto-Schedule
            </button>
            <button
              type="button"
              onClick={() => onOpenWatermark(selectedPins)}
              className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
            >
              <Stamp className="w-3.5 h-3.5 text-amber-400" /> Watermark
            </button>
            <button
              type="button"
              onClick={() => onOpenAspectRatio(selectedPins)}
              className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
            >
              <Crop className="w-3.5 h-3.5 text-purple-400" /> 2:3 Aspect
            </button>
            <button
              type="button"
              onClick={() => onOpenUtmBuilder(selectedPins)}
              className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" /> UTM Tags
            </button>
            <button
              type="button"
              onClick={() => setCopyTargetPins(selectedPins)}
              className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
              title="Copy details of all selected pins to paste into Pinterest"
            >
              <Copy className="w-3.5 h-3.5 text-pink-400" /> Copy Set ({selectedPins.length})
            </button>
            <button
              type="button"
              onClick={() => onDownloadZip(selectedPins)}
              className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" /> ZIP ({selectedPins.length})
            </button>
            <button
              type="button"
              onClick={() => {
                const filename = `pinterest-selected-${selectedPins.length}-pins.csv`;
                downloadPinterestCSV(selectedPins, boards, filename);
              }}
              className="text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-emerald-950/60 hover:bg-emerald-900/80 px-3 py-1.5 rounded-xl border border-emerald-700/60 transition-colors active:scale-95"
              title={`Instant 1-Click CSV download for ${selectedPins.length} selected image${selectedPins.length > 1 ? 's' : ''} only`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Quick CSV ({selectedPins.length})
            </button>
            {onOpenBulkExport && (
              <button
                type="button"
                onClick={() => onOpenBulkExport(selectedPins)}
                className="text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer bg-slate-800 dark:bg-white/[0.08] px-3 py-1.5 rounded-xl border border-slate-700 dark:border-white/[0.08] hover:bg-slate-700 dark:hover:bg-white/[0.12] transition-colors active:scale-95"
                title={`Export ${selectedPins.length} selected image${selectedPins.length > 1 ? 's' : ''} to CSV`}
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" /> Export CSV ({selectedPins.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPublishPins(selectedPins)}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl cursor-pointer transition-colors shadow-sm flex items-center gap-1 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" /> Publish Now ({selectedPins.length})
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-xl cursor-pointer transition-colors active:scale-95"
              title="Delete Selected"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Content View */}
      {filteredPins.length === 0 ? (
        <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/[0.08] p-12 text-center space-y-4 shadow-sm transition-colors amoled-card">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 text-[#E60023] flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No Pins Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || aiFilter !== 'all' || boardFilter !== 'all'
                ? 'No pins match the selected filters or search terms. Try clearing filters.'
                : 'Upload images to start building your Pinterest schedule.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200 dark:shadow-none active:scale-98"
          >
            <Plus className="w-4 h-4" /> Upload New Pins
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <FastTableView
          pins={filteredPins}
          boards={boards}
          websites={websites}
          selectedPinIds={selectedPinIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onUpdatePin={onUpdatePin}
          onDeletePin={(id) => onDeletePins([id])}
          onEditPin={onEditPin}
          onPublishPin={(pin) => onPublishPins([pin])}
          onRetryAiPin={onRetryAiPin}
          language={language}
        />
      ) : (
        /* Grid Bento Card View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredPins.map((pin) => {
            const isSelected = selectedPinIds.has(pin.id);
            const boardName = boards.find(b => b.id === pin.boardId)?.name;

            return (
              <div
                key={pin.id}
                onClick={() => onEditPin(pin)}
                className={`bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border overflow-hidden group cursor-pointer transition-all flex flex-col relative amoled-card ${
                  isSelected
                    ? 'border-[#E60023] ring-2 ring-[#E60023]/20 shadow-md scale-[1.01]'
                    : 'border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.18] shadow-2xs hover:shadow-xs'
                }`}
              >
                {/* Image Aspect Container (2:3 Pinterest Ratio) */}
                <div className="aspect-[2/3] bg-slate-100 dark:bg-white/[0.03] relative overflow-hidden">
                  <img
                    src={pin.thumbnailUrl || pin.imageUrl}
                    alt={pin.title || pin.filename}
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
                  />

                  {/* Selection Checkbox (Top Left) */}
                  <div
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(pin.id);
                    }}
                  >
                    <button
                      type="button"
                      className={`p-1.5 rounded-xl backdrop-blur-md transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#E60023] text-white shadow-2xs'
                          : 'bg-black/60 text-white/80 hover:bg-black hover:text-white'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* AI Status Badge (Top Right) */}
                  <div className="absolute top-2 right-2 z-10">
                    {getAiBadge(pin)}
                  </div>

                  {/* ALWAYS VISIBLE RETRY AI BUTTON ON IMAGE (Bottom Left) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRetryAiPin) {
                        onRetryAiPin(pin);
                      }
                    }}
                    disabled={pin.aiStatus === 'processing'}
                    className="absolute bottom-2 left-2 z-10 bg-black/80 hover:bg-[#E60023] text-white p-1.5 rounded-xl backdrop-blur-md transition-all shadow-xs cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                    title="Retry / Regenerate AI Metadata for this image"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${pin.aiStatus === 'processing' ? 'animate-spin' : ''}`} />
                    <span className="hidden group-hover:inline pr-0.5">Retry AI</span>
                  </button>

                  {/* Quick Delete Button ON IMAGE (Bottom Right) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePins([pin.id]);
                    }}
                    className="absolute bottom-2 right-2 z-10 bg-black/80 hover:bg-rose-600 text-white p-1.5 rounded-xl backdrop-blur-md transition-all shadow-xs cursor-pointer opacity-80 group-hover:opacity-100"
                    title="Delete Pin"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Schedule time pill if scheduled */}
                  {pin.scheduledAt ? (
                    <div className="absolute bottom-10 left-2 right-2 bg-blue-900/90 text-white text-[10px] font-mono py-1 px-2 rounded-lg backdrop-blur-md truncate flex items-center gap-1 shadow-2xs">
                      <CalendarClock className="w-3 h-3 text-blue-300 shrink-0" />
                      <span className="truncate">
                        {new Date(pin.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(pin.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Pin Card Metadata Footer */}
                <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between text-left">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#E60023] dark:group-hover:text-red-400 truncate leading-snug transition-colors">
                      {pin.title || pin.filename}
                    </h4>

                    {boardName ? (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate block">
                        📁 {boardName}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 italic truncate block">
                        No board selected
                      </span>
                    )}

                    {pin.tags && pin.tags.length > 0 ? (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate" title={formatTagsForPinterest(pin.tags)}>
                        {formatTagsForPinterest(pin.tags.slice(0, 3))}
                      </p>
                    ) : null}
                  </div>

                  {/* Quick Card Status Footnote */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[10px]">
                    <span className={`font-bold uppercase tracking-wider ${
                      pin.status === 'published'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : pin.status === 'scheduled'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {pin.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const safeTitle = pin.title ? pin.title.slice(0, 25).replace(/[^a-zA-Z0-9]/g, '_') : 'pin';
                          downloadPinterestCSV([pin], boards, `pinterest-${safeTitle}.csv`);
                        }}
                        className="text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        title="Export this single Pin to CSV"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopyTargetPins([pin]);
                        }}
                        className="text-slate-400 hover:text-[#E60023] dark:hover:text-red-400 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Copy Pin details to paste into Pinterest"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <span className="text-[#E60023] dark:text-red-400 font-bold group-hover:underline flex items-center gap-0.5">
                        <Edit3 className="w-2.5 h-2.5" /> Edit
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Export Section */}
      <BulkExportSection
        pins={pins}
        selectedPins={selectedPins}
        boards={boards}
        onOpenImportCsv={onOpenImportCsv}
        onPinsUpdated={onPinsUpdated}
        className="mt-6"
      />

      {/* Pin Copy Modal for Single or Bulk sets */}
      {copyTargetPins && copyTargetPins.length > 0 && (
        <PinCopyModal
          isOpen={true}
          onClose={() => setCopyTargetPins(null)}
          pins={copyTargetPins}
          boards={boards}
        />
      )}

      {/* URL Split & Website Link Modal */}
      {isUrlSplitModalOpen && selectedPins.length > 0 && (
        <UrlSplitDistributionModal
          isOpen={isUrlSplitModalOpen}
          onClose={() => setIsUrlSplitModalOpen(false)}
          pins={selectedPins}
          websites={websites}
          onApply={(updated) => {
            updated.forEach(p => onUpdatePin(p));
            setIsUrlSplitModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
