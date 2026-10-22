import React, { useState } from 'react';
import { 
  Check, 
  Trash2, 
  Send, 
  RotateCw, 
  Clock, 
  AlertCircle, 
  CheckSquare, 
  Square, 
  Edit3,
  Sparkles,
  Copy,
  FileSpreadsheet
} from 'lucide-react';
import { Pin, Board, Website, PinStatus } from '../../types';
import { aiMetadataQueue } from '../../services/aiMetadataEngine';
import { sanitizeTagList, formatTagsForPinterest } from '../../services/tagsHelper';
import { PinCopyModal } from '../Clipboard/PinCopyModal';
import { downloadPinterestCSV } from '../../services/csvEngine';

interface FastTableViewProps {
  pins: Pin[];
  boards: Board[];
  websites: Website[];
  selectedPinIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onUpdatePin: (pin: Pin) => void;
  onDeletePin: (id: string) => void;
  onEditPin: (pin: Pin) => void;
  onPublishPin: (pin: Pin) => void;
  onRetryAiPin?: (pin: Pin) => void;
  language?: string;
}

export const FastTableView: React.FC<FastTableViewProps> = ({
  pins,
  boards,
  websites = [],
  selectedPinIds,
  onToggleSelect,
  onSelectAll,
  onUpdatePin,
  onDeletePin,
  onEditPin,
  onPublishPin,
  onRetryAiPin,
  language = 'English',
}) => {
  const [copyTargetPin, setCopyTargetPin] = useState<Pin | null>(null);
  const isAllSelected = pins.length > 0 && selectedPinIds.size === pins.length;

  const handleRetryAi = async (pin: Pin, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRetryAiPin) {
      onRetryAiPin(pin);
    } else {
      await aiMetadataQueue.processSinglePin(pin, language, onUpdatePin);
    }
  };

  const getAiStatusBadge = (pin: Pin) => {
    const providerLabel = pin.aiProviderUsed === 'pollinations' ? 'Pollinations' : 'Gemini';

    switch (pin.aiStatus) {
      case 'success':
      case 'completed':
        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold"
              title={`Generated with ${providerLabel}`}
            >
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{providerLabel} ✓</span>
            </span>
            <button
              type="button"
              onClick={(e) => handleRetryAi(pin, e)}
              className="text-[10px] font-bold text-slate-400 dark:text-slate-400 hover:text-[#E60023] dark:hover:text-red-400 flex items-center gap-0.5 cursor-pointer"
              title="Re-generate AI metadata"
            >
              <RotateCw className="w-2.5 h-2.5" /> Re-AI
            </button>
          </div>
        );
      case 'analyzing':
      case 'processing':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 text-[#E60023] dark:text-red-300 border border-red-200 dark:border-red-800 text-[10px] font-bold whitespace-nowrap animate-pulse"
            title={pin.aiStatusDetails || "Analyzing image features..."}
          >
            <RotateCw className="w-3 h-3 animate-spin" /> Analyzing
          </span>
        );
      case 'retrying':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold whitespace-nowrap animate-pulse"
            title={pin.aiStatusDetails || `Retrying attempt ${pin.aiRetryAttempt || 1}`}
          >
            <RotateCw className="w-3 h-3 animate-spin" /> Retry {pin.aiRetryAttempt ? `#${pin.aiRetryAttempt}` : ''}
          </span>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold"
              title={pin.aiError || 'AI Analysis failed'}
            >
              <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Failed
            </span>
            <button
              type="button"
              onClick={(e) => handleRetryAi(pin, e)}
              className="text-[10px] font-bold text-[#E60023] dark:text-red-400 hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <RotateCw className="w-2.5 h-2.5" /> Retry
            </button>
          </div>
        );
      case 'waiting':
      case 'pending':
      default:
        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
              <Clock className="w-3 h-3 text-slate-400" /> Waiting
            </span>
            <button
              type="button"
              onClick={(e) => handleRetryAi(pin, e)}
              className="text-[10px] font-bold text-[#E60023] dark:text-red-400 hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <Sparkles className="w-2.5 h-2.5" /> Generate
            </button>
          </div>
        );
    }
  };

  const getPublishStatusBadge = (status: PinStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Published
          </span>
        );
      case 'scheduled':
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Scheduled
          </span>
        );
      case 'publishing':
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
            Publishing
          </span>
        );
      case 'failed':
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Failed
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-3xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-xs transition-colors amoled-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 border-collapse">
          {/* Table Header */}
          <thead className="bg-[#F7F7F9] dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5 w-10 text-center">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-[#E60023]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="p-3.5 w-16">Image</th>
              <th className="p-3.5 min-w-[140px]">Filename</th>
              <th className="p-3.5 min-w-[200px]">Title</th>
              <th className="p-3.5 min-w-[220px]">Description</th>
              <th className="p-3.5 min-w-[180px]">Destination URL</th>
              <th className="p-3.5 min-w-[180px]">Tagged Topics</th>
              <th className="p-3.5 min-w-[130px]">Board</th>
              <th className="p-3.5 min-w-[150px]">AI Status & Retry</th>
              <th className="p-3.5 min-w-[120px]">Schedule</th>
              <th className="p-3.5 min-w-[100px]">Publish Status</th>
              <th className="p-3.5 w-28 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {pins.map((pin) => {
              const isSelected = selectedPinIds.has(pin.id);

              return (
                <tr
                  key={pin.id}
                  onClick={() => onEditPin(pin)}
                  className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer ${
                    isSelected ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onToggleSelect(pin.id)}
                      className="cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#E60023]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>

                  {/* Thumbnail */}
                  <td className="p-3.5">
                    <div className="w-10 h-14 rounded-lg bg-slate-100 dark:bg-white/[0.04] overflow-hidden border border-slate-200 dark:border-white/[0.08] relative group/thumb shrink-0">
                      <img
                        src={pin.thumbnailUrl || pin.imageUrl}
                        alt=""
                        draggable={false}
                        className="w-full h-full object-cover pointer-events-none select-none"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleRetryAi(pin, e)}
                        className="absolute inset-0 bg-black/80 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
                        title="Retry AI"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Filename */}
                  <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-[140px] truncate" title={pin.filename}>
                    {pin.filename}
                  </td>

                  {/* Title */}
                  <td className="p-3.5 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={pin.title}
                      placeholder="Enter pin title..."
                      onChange={(e) => {
                        onUpdatePin({
                          ...pin,
                          title: e.target.value,
                          titleManuallyEdited: true,
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      className="text-xs bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-white/[0.2] focus:outline-none focus:border-[#E60023] font-semibold text-slate-900 dark:text-slate-100 w-full truncate"
                    />
                  </td>

                  {/* Description */}
                  <td className="p-3.5 max-w-[220px]" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={pin.description}
                      placeholder="Add description..."
                      onChange={(e) => {
                        onUpdatePin({
                          ...pin,
                          description: e.target.value,
                          descriptionManuallyEdited: true,
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      className="text-xs bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-white/[0.2] focus:outline-none focus:border-[#E60023] text-slate-600 dark:text-slate-300 w-full truncate"
                    />
                  </td>

                  {/* Destination URL & Website Link */}
                  <td className="p-3.5 max-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <input
                        type="url"
                        value={pin.destinationUrl || ''}
                        placeholder="https://..."
                        onChange={(e) => {
                          onUpdatePin({
                            ...pin,
                            destinationUrl: e.target.value,
                            updatedAt: new Date().toISOString(),
                          });
                        }}
                        className="text-xs font-mono bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-white/[0.2] focus:outline-none focus:border-[#E60023] text-slate-600 dark:text-slate-300 w-full truncate"
                      />
                      {websites.length > 0 && (
                        <select
                          value={pin.websiteId || ''}
                          onChange={(e) => {
                            const wId = e.target.value;
                            const site = websites.find(w => w.id === wId);
                            onUpdatePin({
                              ...pin,
                              websiteId: wId || undefined,
                              destinationUrl: site ? site.url : pin.destinationUrl,
                              updatedAt: new Date().toISOString(),
                            });
                          }}
                          className="text-[10px] bg-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border-0 focus:outline-none max-w-[20px]"
                          title="Quick link to added website"
                        >
                          <option value="" className="dark:bg-black">🌐</option>
                          {websites.map((w) => (
                            <option key={w.id} value={w.id} className="dark:bg-black text-slate-900 dark:text-white">
                              {w.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>

                  {/* Tags */}
                  <td className="p-3.5 max-w-[180px]" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={pin.tags ? formatTagsForPinterest(pin.tags) : ''}
                      placeholder="matcha guide, green tea recipe"
                      onChange={(e) => {
                        const rawSplit = e.target.value.split(/[,]+/);
                        const newTags = sanitizeTagList(rawSplit);
                        onUpdatePin({
                          ...pin,
                          tags: newTags,
                          tagsManuallyEdited: true,
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      className="text-xs bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-white/[0.2] focus:outline-none focus:border-[#E60023] text-slate-500 dark:text-slate-400 font-mono text-[11px] w-full truncate"
                    />
                  </td>

                  {/* Board */}
                  <td className="p-3.5 min-w-[130px]" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={pin.boardId || ''}
                      onChange={(e) => {
                        onUpdatePin({
                          ...pin,
                          boardId: e.target.value || undefined,
                          updatedAt: new Date().toISOString(),
                        });
                      }}
                      className="text-xs bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-white/[0.2] focus:outline-none focus:border-[#E60023] font-medium text-slate-800 dark:text-slate-200 w-full truncate"
                    >
                      <option value="" className="dark:bg-black text-slate-900 dark:text-white">No Board</option>
                      {boards.map((b) => (
                        <option key={b.id} value={b.id} className="dark:bg-black text-slate-900 dark:text-white">
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* AI Status & Quick Retry */}
                  <td className="p-3.5">
                    {getAiStatusBadge(pin)}
                  </td>

                  {/* Schedule */}
                  <td className="p-3.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {pin.scheduledAt ? (
                      <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(pin.scheduledAt).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}{' '}
                          {new Date(pin.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  {/* Publish Status */}
                  <td className="p-3.5">
                    {getPublishStatusBadge(pin.status)}
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopyTargetPin(pin);
                        }}
                        className="p-1.5 text-slate-400 hover:text-[#E60023] hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer transition-colors"
                        title="Copy Pin details for Pinterest"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRetryAi(pin, e)}
                        className="p-1.5 text-slate-400 hover:text-[#E60023] hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer transition-colors"
                        title="Retry AI Generation"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const safeTitle = pin.title ? pin.title.slice(0, 25).replace(/[^a-zA-Z0-9]/g, '_') : 'pin';
                          downloadPinterestCSV([pin], boards, `pinterest-${safeTitle}.csv`);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg cursor-pointer transition-colors"
                        title="Export this Pin to CSV"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPublishPin(pin)}
                        className="p-1.5 text-slate-400 hover:text-[#E60023] hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer transition-colors"
                        title="Publish Now"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditPin(pin)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-lg cursor-pointer transition-colors"
                        title="Edit Pin"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePin(pin.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                        title="Delete Pin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {copyTargetPin && (
        <PinCopyModal
          isOpen={true}
          onClose={() => setCopyTargetPin(null)}
          pins={[copyTargetPin]}
          boards={boards}
        />
      )}
    </div>
  );
};
