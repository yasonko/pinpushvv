import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  FolderHeart, 
  Globe, 
  Type, 
  FileText, 
  Check, 
  Clock, 
  Calendar,
  AlertCircle,
  Sparkles,
  Shuffle,
  Repeat,
  ListPlus
} from 'lucide-react';
import { Pin, Board, Website, PinStatus } from '../../types';
import { distributeWebsiteUrlsToPins, UrlDistributionMode } from '../../services/urlSplitter';

interface BulkEditModalProps {
  selectedPins: Pin[];
  boards: Board[];
  websites: Website[];
  isOpen: boolean;
  onClose: () => void;
  onApply: (updatedPins: Pin[]) => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  selectedPins,
  boards,
  websites,
  isOpen,
  onClose,
  onApply,
}) => {
  // Selected action tabs
  const [activeAction, setActiveAction] = useState<
    'board' | 'url' | 'title' | 'description' | 'alt' | 'status'
  >('board');

  // Fields
  const [targetBoardId, setTargetBoardId] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [websiteId, setWebsiteId] = useState('');
  const [urlMode, setUrlMode] = useState<'single' | 'round_robin' | 'random' | 'split_custom'>('single');
  const [selectedWebsiteIds, setSelectedWebsiteIds] = useState<string[]>(websites.map(w => w.id));
  const [customSplitUrls, setCustomSplitUrls] = useState<string>(websites.map(w => w.url).join('\n'));

  // Title controls
  const [titleMode, setTitleMode] = useState<'replace' | 'prefix' | 'suffix' | 'find_replace'>('prefix');
  const [titleValue, setTitleValue] = useState('');
  const [titleFind, setTitleFind] = useState('');
  const [titleReplaceWith, setTitleReplaceWith] = useState('');

  // Description controls
  const [descMode, setDescMode] = useState<'overwrite' | 'append' | 'prepend'>('overwrite');
  const [descValue, setDescValue] = useState('');

  // Alt Text controls
  const [altMode, setAltMode] = useState<'overwrite' | 'sync_title'>('sync_title');
  const [altValue, setAltValue] = useState('');

  // Status control
  const [targetStatus, setTargetStatus] = useState<PinStatus>('draft');

  const handleApplyChanges = () => {
    const now = new Date().toISOString();

    let updated = selectedPins.map((pin) => {
      let nextPin = { ...pin, updatedAt: now };

      if (activeAction === 'board' && targetBoardId) {
        nextPin.boardId = targetBoardId;
      }

      if (activeAction === 'url' && urlMode === 'single' && (targetUrl || '').trim()) {
        nextPin.destinationUrl = targetUrl.trim();
        if (websiteId) nextPin.websiteId = websiteId;
      }

      if (activeAction === 'title') {
        const cleanTitleVal = (titleValue || '').trim();
        const curTitle = pin.title || pin.filename || '';
        if (titleMode === 'replace' && cleanTitleVal) {
          nextPin.title = cleanTitleVal;
        } else if (titleMode === 'prefix' && cleanTitleVal) {
          nextPin.title = `${cleanTitleVal} ${curTitle}`.trim();
        } else if (titleMode === 'suffix' && cleanTitleVal) {
          nextPin.title = `${curTitle} ${cleanTitleVal}`.trim();
        } else if (titleMode === 'find_replace' && titleFind) {
          nextPin.title = curTitle.replaceAll(titleFind, titleReplaceWith || '');
        }
      }

      if (activeAction === 'description') {
        if (descMode === 'overwrite') {
          nextPin.description = descValue || '';
        } else if (descMode === 'append') {
          nextPin.description = pin.description ? `${pin.description}\n\n${descValue || ''}` : (descValue || '');
        } else if (descMode === 'prepend') {
          nextPin.description = pin.description ? `${descValue || ''}\n\n${pin.description}` : (descValue || '');
        }
      }

      if (activeAction === 'alt') {
        if (altMode === 'sync_title') {
          nextPin.altText = nextPin.title;
        } else if ((altValue || '').trim()) {
          nextPin.altText = (altValue || '').trim();
        }
      }

      if (activeAction === 'status') {
        nextPin.status = targetStatus;
      }

      return nextPin;
    });

    if (activeAction === 'url' && urlMode !== 'single') {
      const chosenWebsites = websites.filter(w => selectedWebsiteIds.includes(w.id));
      const pool = chosenWebsites.length > 0 ? chosenWebsites : websites;

      if (urlMode === 'split_custom') {
        const parsedCustomUrls = customSplitUrls
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => (/^https?:\/\//i.test(line) ? line : `https://${line}`));

        updated = distributeWebsiteUrlsToPins(updated, websites, {
          mode: 'round_robin',
          customUrlList: parsedCustomUrls,
        });
      } else {
        updated = distributeWebsiteUrlsToPins(updated, pool, {
          mode: urlMode as 'round_robin' | 'random',
        });
      }
    }

    onApply(updated);
    onClose();
  };

  if (!isOpen || selectedPins.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white/95 dark:bg-black/95 dark:backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] w-full max-w-2xl overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Bulk Edit Pins</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Modifying {selectedPins.length} selected pin{selectedPins.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs Bar */}
        <div className="flex border-b border-slate-200 dark:border-white/[0.08] bg-slate-100/60 dark:bg-black/40 p-1.5 gap-1 overflow-x-auto text-xs">
          {[
            { id: 'board', label: 'Set Board', icon: FolderHeart },
            { id: 'url', label: 'Set Destination URL', icon: Globe },
            { id: 'title', label: 'Transform Titles', icon: Type },
            { id: 'description', label: 'Set Description', icon: FileText },
            { id: 'alt', label: 'Set Alt Text', icon: Sparkles },
            { id: 'status', label: 'Change Status', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeAction === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveAction(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-white/[0.08] text-rose-600 dark:text-rose-400 shadow-xs border border-slate-200 dark:border-white/[0.12]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Form Content */}
        <div className="p-6 space-y-4 min-h-[220px] bg-white dark:bg-transparent">
          {/* TAB 1: SET BOARD */}
          {activeAction === 'board' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Assign Board to all {selectedPins.length} selected Pins
              </label>
              <select
                value={targetBoardId}
                onChange={(e) => setTargetBoardId(e.target.value)}
                className="w-full text-sm font-medium p-2.5 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              >
                <option value="" className="bg-white dark:bg-black text-slate-900 dark:text-white">-- Choose a Board --</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id} className="bg-white dark:bg-black text-slate-900 dark:text-white">
                    {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All selected pins will be assigned to this Pinterest board.
              </p>
            </div>
          )}

          {/* TAB 2: SET DESTINATION URL */}
          {activeAction === 'url' && (
            <div className="space-y-3.5">
              {/* URL Distribution Mode Switcher */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl text-[11px] font-bold border border-transparent dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setUrlMode('single')}
                  className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                    urlMode === 'single'
                      ? 'bg-white dark:bg-white/[0.1] text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Single URL
                </button>
                <button
                  type="button"
                  onClick={() => setUrlMode('round_robin')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                    urlMode === 'round_robin'
                      ? 'bg-white dark:bg-white/[0.1] text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Repeat className="w-3 h-3" />
                  <span>Split Cycle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUrlMode('random')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                    urlMode === 'random'
                      ? 'bg-white dark:bg-white/[0.1] text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Random</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUrlMode('split_custom')}
                  className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                    urlMode === 'split_custom'
                      ? 'bg-white dark:bg-white/[0.1] text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <ListPlus className="w-3 h-3" />
                  <span>Split List</span>
                </button>
              </div>

              {/* Single URL Mode */}
              {urlMode === 'single' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Target Destination URL
                    </label>
                    {websites.length > 0 && (
                      <select
                        value={websiteId}
                        onChange={(e) => {
                          setWebsiteId(e.target.value);
                          const w = websites.find(item => item.id === e.target.value);
                          if (w) setTargetUrl(w.url);
                        }}
                        className="text-xs text-rose-600 dark:text-rose-400 bg-transparent border-0 font-medium cursor-pointer"
                      >
                        <option value="" className="bg-white dark:bg-black text-slate-900 dark:text-white">Select from Websites...</option>
                        {websites.map(w => (
                          <option key={w.id} value={w.id} className="bg-white dark:bg-black text-slate-900 dark:text-white">{w.name} ({w.url})</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://mysite.com/article-or-product"
                      className="w-full text-xs font-mono pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* Round-Robin or Random Mode across Websites */}
              {(urlMode === 'round_robin' || urlMode === 'random') && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Select Websites to Distribute ({selectedWebsiteIds.length}/{websites.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedWebsiteIds(websites.map(w => w.id))}
                      className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                  </div>
                  {websites.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {websites.map(w => {
                        const isChecked = selectedWebsiteIds.includes(w.id);
                        return (
                          <div
                            key={w.id}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedWebsiteIds(selectedWebsiteIds.filter(id => id !== w.id));
                              } else {
                                setSelectedWebsiteIds([...selectedWebsiteIds, w.id]);
                              }
                            }}
                            className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                              isChecked
                                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                                : 'bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/[0.08]'
                            }`}
                          >
                            <div className="truncate">
                              <div className="font-bold text-slate-900 dark:text-white truncate">{w.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">{w.url}</div>
                            </div>
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isChecked ? 'bg-[#E60023] text-white border-[#E60023]' : 'border-slate-300 dark:border-white/[0.15]'
                            }`}>
                              {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-xl text-xs">
                      No websites registered. Add websites in the Websites tab or use Custom Split List.
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {urlMode === 'round_robin' 
                      ? 'URLs will cycle evenly across all selected pins.'
                      : 'URLs will be chosen randomly from selected websites for each pin.'}
                  </p>
                </div>
              )}

              {/* Custom Split List Mode */}
              {urlMode === 'split_custom' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Paste Multiple Destination URLs (1 URL per line)
                  </label>
                  <textarea
                    rows={4}
                    value={customSplitUrls}
                    onChange={(e) => setCustomSplitUrls(e.target.value)}
                    placeholder="https://mysite.com/article-1&#10;https://mysite.com/article-2"
                    className="w-full text-xs font-mono p-2.5 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    The engine will assign these URLs across {selectedPins.length} pins sequentially.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRANSFORM TITLES */}
          {activeAction === 'title' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(
                  [
                    { id: 'prefix', label: 'Add Prefix' },
                    { id: 'suffix', label: 'Add Suffix' },
                    { id: 'find_replace', label: 'Find & Replace' },
                    { id: 'replace', label: 'Overwrite All' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setTitleMode(mode.id)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium border cursor-pointer transition-colors ${
                      titleMode === mode.id
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold'
                        : 'bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {titleMode === 'find_replace' ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Find text..."
                    value={titleFind}
                    onChange={(e) => setTitleFind(e.target.value)}
                    className="text-xs p-2 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Replace with..."
                    value={titleReplaceWith}
                    onChange={(e) => setTitleReplaceWith(e.target.value)}
                    className="text-xs p-2 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={
                    titleMode === 'prefix'
                      ? 'e.g. [2026 Ideas]'
                      : titleMode === 'suffix'
                      ? 'e.g. - Free Guide'
                      : 'New title for all selected pins'
                  }
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              )}
            </div>
          )}

          {/* TAB 4: DESCRIPTION */}
          {activeAction === 'description' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(
                  [
                    { id: 'overwrite', label: 'Overwrite All' },
                    { id: 'append', label: 'Append to Bottom' },
                    { id: 'prepend', label: 'Prepend to Top' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setDescMode(m.id)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium border cursor-pointer transition-colors ${
                      descMode === m.id
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold'
                        : 'bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                placeholder="Enter description text..."
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

          {/* TAB 5: ALT TEXT */}
          {activeAction === 'alt' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setAltMode('sync_title')}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
                    altMode === 'sync_title'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold'
                      : 'bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]'
                  }`}
                >
                  Sync Alt Text with Pin Title
                </button>
                <button
                  onClick={() => setAltMode('overwrite')}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
                    altMode === 'overwrite'
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold'
                      : 'bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]'
                  }`}
                >
                  Custom Alt Text
                </button>
              </div>

              {altMode === 'overwrite' && (
                <input
                  type="text"
                  value={altValue}
                  onChange={(e) => setAltValue(e.target.value)}
                  placeholder="Descriptive accessibility text..."
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              )}
            </div>
          )}

          {/* TAB 6: STATUS */}
          {activeAction === 'status' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Change Status of {selectedPins.length} Pins
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as PinStatus)}
                className="w-full text-sm font-medium p-2.5 bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              >
                <option value="draft" className="bg-white dark:bg-black text-slate-900 dark:text-white">Draft</option>
                <option value="scheduled" className="bg-white dark:bg-black text-slate-900 dark:text-white">Scheduled</option>
                <option value="published" className="bg-white dark:bg-black text-slate-900 dark:text-white">Published</option>
                <option value="failed" className="bg-white dark:bg-black text-slate-900 dark:text-white">Failed</option>
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-black/60 border border-slate-200 dark:border-white/[0.08] px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyChanges}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 px-4 py-2 rounded-lg cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply to {selectedPins.length} Pins</span>
          </button>
        </div>
      </div>
    </div>
  );
};
