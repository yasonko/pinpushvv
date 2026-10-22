import React, { useState } from 'react';
import { Tag, Copy, Check, X, Plus } from 'lucide-react';
import { sanitizeTagList, formatTagsAsLines, formatTagsForPinterest, sanitizeTag } from '../../services/tagsHelper';
import { copyToClipboard } from '../../services/clipboardHelper';

interface TagChipsProps {
  tags?: (string | null | undefined)[];
  editable?: boolean;
  onRemoveTag?: (index: number) => void;
  onAddTag?: (newTag: string) => void;
  showCopyAll?: boolean;
  copyAllMode?: 'lines' | 'comma';
  className?: string;
  size?: 'sm' | 'md';
}

export const TagChips: React.FC<TagChipsProps> = ({
  tags = [],
  editable = false,
  onRemoveTag,
  onAddTag,
  showCopyAll = true,
  copyAllMode = 'lines',
  className = '',
  size = 'md',
}) => {
  const cleanTags = sanitizeTagList(tags);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const handleCopySingle = async (tag: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    // Copy only the single cleaned tag keyword: no '#', no commas, no newlines, no quotes
    const success = await copyToClipboard(tag);
    if (success) {
      setCopiedTag(tag);
      setTimeout(() => {
        setCopiedTag((curr) => (curr === tag ? null : curr));
      }, 1500);
    }
  };

  const handleCopyAll = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (cleanTags.length === 0) return;

    // Line separated per requirement (or comma separated if configured)
    const textToCopy = copyAllMode === 'lines' 
      ? formatTagsAsLines(cleanTags) 
      : formatTagsForPinterest(cleanTags);

    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => {
        setCopiedAll(false);
      }, 1500);
    }
  };

  const handleAddSubmit = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && 'key' in e && e.key !== 'Enter' && e.key !== ',') return;
    if (e) e.preventDefault();

    const clean = sanitizeTag(newTagInput);
    if (clean && onAddTag && !cleanTags.includes(clean)) {
      onAddTag(clean);
      setNewTagInput('');
    } else if (clean) {
      setNewTagInput('');
    }
  };

  if (cleanTags.length === 0 && !editable) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500 italic">
        (No tags available)
      </span>
    );
  }

  const isSmall = size === 'sm';

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with Copy All action */}
      {showCopyAll && cleanTags.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            Pinterest Tagged Topics ({cleanTags.length})
          </span>
          <button
            type="button"
            onClick={handleCopyAll}
            aria-label="Copy all topics"
            title="Copy all topics (one per line)"
            className="text-xs font-bold text-[#E60023] dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#E60023]/30 rounded px-1"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied ✓</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Interactive Chip List */}
      <div 
        className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-2 bg-[#F7F7F9] dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors"
        role="list"
        aria-label="Pinterest tagged topics"
      >
        {cleanTags.map((tag, idx) => {
          const isCopied = copiedTag === tag;

          return (
            <div
              key={`${tag}-${idx}`}
              role="button"
              tabIndex={0}
              onClick={(e) => handleCopySingle(tag, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCopySingle(tag, e);
                }
              }}
              title={isCopied ? 'Copied!' : `Copy "${tag}"`}
              aria-label={isCopied ? `Copied: ${tag}` : `Copy topic: ${tag}`}
              className={`
                group relative inline-flex items-center gap-1.5 select-none transition-all duration-200 cursor-pointer
                rounded-lg font-medium outline-none
                focus:ring-2 focus:ring-[#E60023] focus:ring-offset-1 dark:focus:ring-offset-slate-900
                active:scale-95
                ${isSmall ? 'text-[11px] px-2 py-1' : 'text-xs px-2.5 py-1.5'}
                ${isCopied 
                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs' 
                  : 'bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs'
                }
              `}
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0 animate-in fade-in zoom-in-75 duration-150" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">✓ Copied</span>
                </>
              ) : (
                <>
                  <span>{tag}</span>
                  <Copy className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </>
              )}

              {/* Editable Delete Button */}
              {editable && onRemoveTag && (
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTag(idx);
                  }}
                  className="ml-0.5 p-0.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Input for adding tag when in editor mode */}
        {editable && (
          <div className="flex items-center gap-1 flex-1 min-w-[130px] p-0.5">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleAddSubmit}
              placeholder="Add tag + Enter..."
              className="w-full text-xs bg-transparent focus:outline-none px-2 py-1 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {newTagInput.trim() && (
              <button
                type="button"
                onClick={handleAddSubmit}
                className="p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                title="Add Tag"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
