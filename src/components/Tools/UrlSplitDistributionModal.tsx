import React, { useState } from 'react';
import { 
  X, 
  Globe, 
  Shuffle, 
  Repeat, 
  Sparkles, 
  Check, 
  ListPlus, 
  Layers, 
  ArrowRight,
  ExternalLink,
  Plus
} from 'lucide-react';
import { Pin, Website } from '../../types';
import { distributeWebsiteUrlsToPins, UrlDistributionMode } from '../../services/urlSplitter';

interface UrlSplitDistributionModalProps {
  pins: Pin[];
  websites: Website[];
  isOpen: boolean;
  onClose: () => void;
  onApply: (updatedPins: Pin[]) => void;
}

export const UrlSplitDistributionModal: React.FC<UrlSplitDistributionModalProps> = ({
  pins,
  websites,
  isOpen,
  onClose,
  onApply,
}) => {
  const [mode, setMode] = useState<UrlDistributionMode>('round_robin');
  const [selectedWebsiteIds, setSelectedWebsiteIds] = useState<string[]>(
    websites.map(w => w.id)
  );
  const [customUrlsText, setCustomUrlsText] = useState<string>(
    websites.map(w => w.url).join('\n')
  );
  const [singleUrl, setSingleUrl] = useState<string>(
    websites[0]?.url || ''
  );

  const toggleWebsiteSelection = (id: string) => {
    if (selectedWebsiteIds.includes(id)) {
      setSelectedWebsiteIds(selectedWebsiteIds.filter(wId => wId !== id));
    } else {
      setSelectedWebsiteIds([...selectedWebsiteIds, id]);
    }
  };

  const selectAllWebsites = () => {
    setSelectedWebsiteIds(websites.map(w => w.id));
  };

  // Parse lines for custom split list
  const parsedCustomUrls = customUrlsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => (/^https?:\/\//i.test(line) ? line : `https://${line}`));

  const handleApply = () => {
    let chosenWebsites = websites.filter(w => selectedWebsiteIds.includes(w.id));
    if (chosenWebsites.length === 0 && websites.length > 0) {
      chosenWebsites = websites;
    }

    let updated: Pin[] = [];

    if (mode === 'single') {
      updated = distributeWebsiteUrlsToPins(pins, websites, {
        mode: 'single',
        singleUrl: singleUrl.trim(),
      });
    } else if (mode === 'split_custom') {
      updated = distributeWebsiteUrlsToPins(pins, websites, {
        mode: 'round_robin',
        customUrlList: parsedCustomUrls,
      });
    } else {
      // round_robin or random using chosen websites
      updated = distributeWebsiteUrlsToPins(pins, chosenWebsites, {
        mode: mode as 'round_robin' | 'random',
      });
    }

    onApply(updated);
    onClose();
  };

  // Build a quick preview of how URLs will be mapped to the first 5 pins
  const previewMapping = pins.slice(0, 5).map((pin, index) => {
    let dest = '';
    if (mode === 'single') {
      dest = singleUrl || '(Empty URL)';
    } else if (mode === 'split_custom') {
      if (parsedCustomUrls.length > 0) {
        dest = parsedCustomUrls[index % parsedCustomUrls.length];
      } else {
        dest = '(Enter URLs below)';
      }
    } else {
      const activeWebs = websites.filter(w => selectedWebsiteIds.includes(w.id));
      const pool = activeWebs.length > 0 ? activeWebs : websites;
      if (pool.length > 0) {
        dest = pool[index % pool.length].url;
      } else {
        dest = '(No websites added yet)';
      }
    }
    return {
      title: pin.title || pin.filename,
      destUrl: dest,
    };
  });

  if (!isOpen || pins.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E60023] text-white flex items-center justify-center shadow-xs">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Destination URL Split & Link Manager
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Distribute and assign destination URLs across {pins.length} Pins
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setMode('round_robin')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold transition-all cursor-pointer ${
              mode === 'round_robin'
                ? 'bg-white dark:bg-slate-800 text-[#E60023] dark:text-red-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Round-Robin Split</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('random')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold transition-all cursor-pointer ${
              mode === 'random'
                ? 'bg-white dark:bg-slate-800 text-[#E60023] dark:text-red-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Randomized Split</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('split_custom')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold transition-all cursor-pointer ${
              mode === 'split_custom'
                ? 'bg-white dark:bg-slate-800 text-[#E60023] dark:text-red-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Custom Split List</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto bg-white dark:bg-slate-900">
          {/* Mode 1 & 2: Added Websites Selection */}
          {(mode === 'round_robin' || mode === 'random') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#E60023]" />
                  Select Added Websites to Distribute ({selectedWebsiteIds.length}/{websites.length})
                </label>
                {websites.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllWebsites}
                    className="text-[11px] font-bold text-[#E60023] dark:text-red-400 hover:underline cursor-pointer"
                  >
                    Select All Websites
                  </button>
                )}
              </div>

              {websites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {websites.map(web => {
                    const isChecked = selectedWebsiteIds.includes(web.id);
                    return (
                      <div
                        key={web.id}
                        onClick={() => toggleWebsiteSelection(web.id)}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-red-50/50 dark:bg-red-950/30 border-red-300 dark:border-red-800 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {web.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {web.url}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border ${
                          isChecked
                            ? 'bg-[#E60023] text-white border-[#E60023]'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                        }`}>
                          {isChecked ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-bold">No Websites Registered Yet</div>
                  <p>You can switch to the "Custom Split List" tab above to paste a list of URLs, or add websites in the "Websites" tab.</p>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Custom Split List (Multi-line URLs) */}
          {mode === 'split_custom' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ListPlus className="w-3.5 h-3.5 text-[#E60023]" />
                  Paste Multiple URLs (1 URL per line)
                </label>
                <span className="text-xs font-mono font-bold text-[#E60023] dark:text-red-400">
                  {parsedCustomUrls.length} valid URL{parsedCustomUrls.length !== 1 ? 's' : ''} detected
                </span>
              </div>
              <textarea
                rows={6}
                value={customUrlsText}
                onChange={(e) => setCustomUrlsText(e.target.value)}
                placeholder="https://mysite.com/article-1&#10;https://mysite.com/article-2&#10;https://anothershop.com/product"
                className="w-full text-xs font-mono p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 focus:border-[#E60023]"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                The engine will cycle sequentially (Round-Robin) through each URL across all {pins.length} Pins.
              </p>
            </div>
          )}

          {/* Live Preview Mapping Box */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                Distribution Preview (First {previewMapping.length} Pins)
              </span>
              <span className="text-[10px] text-slate-400">
                Mode: {mode === 'round_robin' ? 'Even Cycle' : mode === 'random' ? 'Random Shuffled' : 'Custom Sequence'}
              </span>
            </div>

            <div className="space-y-1.5">
              {previewMapping.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                    {idx + 1}. {item.title}
                  </span>
                  <div className="flex items-center gap-1 min-w-0 text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate">
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-[#E60023] dark:text-red-400 truncate">{item.destUrl}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-1.5 text-xs font-extrabold px-5 py-2.5 rounded-xl bg-[#E60023] hover:bg-[#ad001a] text-white cursor-pointer shadow-md shadow-red-200 dark:shadow-none transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Apply URL Distribution to {pins.length} Pins</span>
          </button>
        </div>
      </div>
    </div>
  );
};
