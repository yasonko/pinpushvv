import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  FileText, 
  Table, 
  Code, 
  Sparkles, 
  Layers, 
  Globe, 
  FolderHeart,
  Tag,
  Zap
} from 'lucide-react';
import { Pin, Board } from '../../types';
import { 
  formatSinglePin, 
  formatPinSet, 
  copyToClipboard, 
  downloadPinImageFile, 
  openPinterestPinBuilder 
} from '../../services/clipboardHelper';
import { copyPinToExtension } from '../../services/extensionBridge';
import { formatTagsForPinterest } from '../../services/tagsHelper';
import { TagChips } from '../Tags/TagChips';

interface PinCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  pins: Pin[];
  boards: Board[];
}

export const PinCopyModal: React.FC<PinCopyModalProps> = ({
  isOpen,
  onClose,
  pins,
  boards,
}) => {
  const [format, setFormat] = useState<'quick' | 'text' | 'tsv' | 'csv' | 'json'>('quick');
  const [includeTags, setIncludeTags] = useState(true);
  const [includeAltText, setIncludeAltText] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isSingle = pins.length === 1;
  const primaryPin = pins[0];
  const primaryBoardName = primaryPin ? boards.find(b => b.id === primaryPin.boardId)?.name : undefined;

  const handleCopy = async (text: string, keyName: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(keyName);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const currentFormattedText = formatPinSet(
    pins, 
    boards, 
    format === 'quick' ? 'text' : format, 
    { includeTags, includeAltText }
  );

  if (!isOpen || pins.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#F7F7F9] dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#E60023] flex items-center justify-center">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isSingle ? 'Copy Pin for Pinterest' : `Copy Pin Set (${pins.length} Pins)`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Easily copy fields or entire pin sets to paste into Pinterest or spreadsheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openPinterestPinBuilder}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#E60023] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-800/60 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
              title="Open Pinterest Pin Builder in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Pinterest</span>
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

        {/* Format Selector Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-1 bg-[#F7F7F9] dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {isSingle && (
              <button
                type="button"
                onClick={() => setFormat('quick')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  format === 'quick'
                    ? 'bg-white dark:bg-slate-700 text-[#E60023] dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Quick Fields
              </button>
            )}
            <button
              type="button"
              onClick={() => setFormat('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                format === 'text'
                  ? 'bg-white dark:bg-slate-700 text-[#E60023] dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Formatted Text
            </button>
            <button
              type="button"
              onClick={() => setFormat('tsv')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                format === 'tsv'
                  ? 'bg-white dark:bg-slate-700 text-[#E60023] dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Tab-separated for Excel / Google Sheets"
            >
              <Table className="w-3.5 h-3.5" /> Sheets / TSV
            </button>
            <button
              type="button"
              onClick={() => setFormat('csv')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                format === 'csv'
                  ? 'bg-white dark:bg-slate-700 text-[#E60023] dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => setFormat('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                format === 'json'
                  ? 'bg-white dark:bg-slate-700 text-[#E60023] dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Code className="w-3.5 h-3.5" /> JSON
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeTags}
                onChange={(e) => setIncludeTags(e.target.checked)}
                className="rounded accent-[#E60023]"
              />
              <span className="font-medium">Include Tags</span>
            </label>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Quick Fields Mode (Single Pin) */}
          {format === 'quick' && isSingle ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Thumbnail & Quick Download (4 Cols) */}
              <div className="md:col-span-4 space-y-3">
                <div className="aspect-[2/3] max-h-[300px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 mx-auto">
                  <img
                    src={primaryPin.imageUrl}
                    alt={primaryPin.title || primaryPin.filename}
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => downloadPinImageFile(primaryPin)}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#F7F7F9] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download Image
                </button>
              </div>

              {/* Individual Copy Blocks (8 Cols) */}
              <div className="md:col-span-8 space-y-3">
                {/* Title */}
                <div className="p-3 bg-[#F7F7F9] dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Title
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(primaryPin.title || primaryPin.filename, 'title')}
                      className="text-xs font-bold text-[#E60023] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'title' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Title
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    {primaryPin.title || primaryPin.filename}
                  </p>
                </div>

                {/* Description */}
                <div className="p-3 bg-[#F7F7F9] dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Description
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(primaryPin.description || '', 'desc')}
                      className="text-xs font-bold text-[#E60023] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'desc' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copied ✓</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Description
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {primaryPin.description || '(No description generated yet)'}
                  </p>
                </div>

                {/* Tags (Keywords Chips) */}
                <div className="p-3 bg-[#F7F7F9] dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <TagChips 
                    tags={primaryPin.tags} 
                    editable={false}
                    copyAllMode="lines"
                    showCopyAll={true}
                  />
                </div>

                {/* Link */}
                <div className="p-3 bg-[#F7F7F9] dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Destination Link
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(primaryPin.destinationUrl || '', 'link')}
                      disabled={!primaryPin.destinationUrl}
                      className="text-xs font-bold text-[#E60023] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      {copiedKey === 'link' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Link
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                    {primaryPin.destinationUrl || '(No URL provided)'}
                  </p>
                </div>

                {/* Board & Alt Text Quick Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="p-3 bg-[#F7F7F9] dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <FolderHeart className="w-3 h-3" /> Board
                      </span>
                      {primaryBoardName && (
                        <button
                          type="button"
                          onClick={() => handleCopy(primaryBoardName, 'board')}
                          className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                        >
                          {copiedKey === 'board' ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                      {primaryBoardName || 'None selected'}
                    </p>
                  </div>

                  <div className="p-3 bg-[#F7F7F9] dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Alt Text
                      </span>
                      {primaryPin.altText && (
                        <button
                          type="button"
                          onClick={() => handleCopy(primaryPin.altText || '', 'alt')}
                          className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                        >
                          {copiedKey === 'alt' ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                      {primaryPin.altText || primaryPin.title || primaryPin.filename}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Multi-Pin or Code Preview Mode */
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  readOnly
                  rows={14}
                  value={currentFormattedText}
                  className="w-full font-mono text-xs p-4 bg-[#F7F7F9] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-200 focus:outline-none leading-relaxed select-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Tip: Click inside the box or use the &quot;Copy to Clipboard&quot; button below to copy the full set at once.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm"
            >
              Close
            </button>
            <button
              type="button"
              onClick={openPinterestPinBuilder}
              className="sm:hidden text-xs font-bold text-[#E60023] bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 rounded-xl cursor-pointer"
            >
              Open Pinterest
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isSingle && (
              <button
                type="button"
                onClick={async () => {
                  const res = await copyPinToExtension(primaryPin, primaryBoardName);
                  setCopiedKey('extension');
                  setTimeout(() => setCopiedKey(null), 2500);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl cursor-pointer transition-all"
              >
                {copiedKey === 'extension' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Sent to Extension ✓</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-[#E60023]" />
                    <span>Copy to Extension</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleCopy(currentFormattedText, 'all')}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#E60023] hover:bg-[#ad001a] px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200 dark:shadow-none"
            >
              {copiedKey === 'all' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied Successfully!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>
                    {isSingle ? 'Copy All Pin Details' : `Copy All ${pins.length} Pins to Clipboard`}
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
