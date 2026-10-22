import React, { useState } from 'react';
import { 
  Tag, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  X, 
  Plus, 
  Copy, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  RefreshCw, 
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { Pin, PinKeywordDetail, KeywordValidationSummary } from '../../types';
import { executePinSmartTagsValidation, normalizeCandidate } from '../../services/pinterestTagValidator';
import { copyToClipboard } from '../../services/clipboardHelper';
import { formatTagsAsLines, formatTagsForPinterest } from '../../services/tagsHelper';

interface PinterestKeywordValidatorUIProps {
  pin: Pin;
  tags: string[];
  keywordDetails?: PinKeywordDetail[];
  keywordSummary?: KeywordValidationSummary;
  onChange: (updatedTags: string[], updatedDetails?: PinKeywordDetail[], summary?: KeywordValidationSummary) => void;
  language?: string;
  className?: string;
}

export const PinterestKeywordValidatorUI: React.FC<PinterestKeywordValidatorUIProps> = ({
  pin,
  tags = [],
  keywordDetails = [],
  keywordSummary,
  onChange,
  language = 'English',
  className = '',
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [maxKeywordLimit, setMaxKeywordLimit] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<'all' | 'validated' | 'matched' | 'manual'>('all');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Synchronize current tags with details
  const activeDetails: PinKeywordDetail[] = tags.map((tag) => {
    const existing = (keywordDetails || []).find(
      (d) => d.value.toLowerCase() === tag.toLowerCase()
    );
    if (existing) return existing;
    return {
      value: tag.toLowerCase(),
      displayValue: tag.charAt(0).toUpperCase() + tag.slice(1),
      source: 'manual',
      status: 'validated',
      confidence: 1.0,
      matchReason: 'Manual tag',
    };
  });

  const handleGenerateAndValidate = async (allowUnverified = false) => {
    setIsValidating(true);
    setValidationError(null);
    try {
      const result = await executePinSmartTagsValidation(pin, {
        language,
        maxLimit: maxKeywordLimit,
        allowUnverifiedFallback: allowUnverified,
      });

      onChange(result.cleanTags, result.keywordDetails, result.summary);
    } catch (err: any) {
      console.error('[Keyword Validator] Validation error:', err);
      setValidationError(err?.message || 'Keyword validation encountered an error. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddManualTag = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e && 'key' in e && e.key !== 'Enter' && e.key !== ',') return;
    if (e) e.preventDefault();

    const norm = normalizeCandidate(newTagInput);
    if (!norm) {
      setNewTagInput('');
      return;
    }

    if (tags.some((t) => t.toLowerCase() === norm.normalized)) {
      setNewTagInput('');
      return;
    }

    const newDetail: PinKeywordDetail = {
      value: norm.normalized,
      displayValue: norm.display,
      source: 'manual',
      status: 'validated',
      confidence: 1.0,
      matchReason: 'Manually added by user (protected from AI overwrites)',
      validatedAt: new Date().toISOString(),
    };

    const nextTags = [...tags, norm.normalized];
    const nextDetails = [...(keywordDetails || []), newDetail];

    onChange(nextTags, nextDetails, keywordSummary);
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
    const nextDetails = (keywordDetails || []).filter(
      (d) => d.value.toLowerCase() !== tagToRemove.toLowerCase()
    );
    onChange(nextTags, nextDetails, keywordSummary);
  };

  const handleCopySingle = async (kw: string) => {
    const success = await copyToClipboard(kw);
    if (success) {
      setCopiedKeyword(kw);
      setTimeout(() => setCopiedKeyword(null), 1500);
    }
  };

  const handleCopyAll = async (mode: 'lines' | 'comma' = 'lines') => {
    if (tags.length === 0) return;
    const text = mode === 'lines' ? formatTagsAsLines(tags) : formatTagsForPinterest(tags);
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    }
  };

  const filteredDetails = activeDetails.filter((d) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'manual') return d.source === 'manual';
    if (statusFilter === 'validated') return d.status === 'validated' && d.source !== 'manual';
    if (statusFilter === 'matched') return d.status === 'matched';
    return true;
  });

  return (
    <div className={`p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3.5 ${className}`}>
      {/* Header with Title, Action Button & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 flex items-center justify-center text-[#E60023] shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Pinterest Smart Tags & SEO Keywords
              </h4>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold">
                {tags.length} Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Validated against authentic Pinterest search intent (No fake keywords or hashtags)
            </p>
          </div>
        </div>

        {/* Generate & Validate Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleGenerateAndValidate(false)}
            disabled={isValidating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E60023] hover:bg-red-700 text-white font-bold text-xs shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer"
            title="Generate 30-50 candidate keywords, validate on Pinterest, smart replace bloated phrases, and keep top 10"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
            <span>{isValidating ? 'Validating on Pinterest...' : 'Generate & Validate'}</span>
          </button>
        </div>
      </div>

      {/* Validation Error Banner / Fallback */}
      {validationError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 rounded-xl flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Pinterest live validation notice
              </span>
              <p className="text-amber-800 dark:text-amber-300 text-[11px]">
                {validationError}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleGenerateAndValidate(true)}
                  className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-semibold text-[11px] hover:bg-amber-300 cursor-pointer"
                >
                  Use Unverified Suggestions
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateAndValidate(false)}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] hover:bg-slate-50 cursor-pointer"
                >
                  Retry Validation
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-amber-500 hover:text-amber-700 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar: Limit Selector, Filters & Copy All */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            All ({tags.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('validated')}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              statusFilter === 'validated'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <Check className="w-3 h-3" />
            <span>Validated</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('matched')}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              statusFilter === 'matched'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Smart Matched</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('manual')}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              statusFilter === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
            }`}
          >
            Manual User Tags
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Tag Limit Picker */}
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <SlidersHorizontal className="w-3 h-3" />
            <span>Max:</span>
            <select
              value={maxKeywordLimit}
              onChange={(e) => setMaxKeywordLimit(Number(e.target.value))}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value={5}>5 tags</option>
              <option value={8}>8 tags</option>
              <option value={10}>10 tags (Recommended)</option>
              <option value={12}>12 tags</option>
              <option value={15}>15 tags</option>
            </select>
          </div>

          {/* Copy All Action */}
          {tags.length > 0 && (
            <button
              type="button"
              onClick={() => handleCopyAll('lines')}
              className="text-xs font-bold text-[#E60023] dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="Copy all tags (one per line)"
            >
              {copiedAll ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedAll ? 'Copied!' : 'Copy All'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tag Chips Display */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-2 min-h-[50px] items-center">
        {filteredDetails.map((detail, idx) => {
          const isCopied = copiedKeyword === detail.value;
          const isMatched = detail.status === 'matched';
          const isManual = detail.source === 'manual';
          const isUnverified = detail.status === 'unverified';

          return (
            <div
              key={`${detail.value}-${idx}`}
              onClick={() => handleCopySingle(detail.value)}
              className={`
                group relative inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl text-xs font-medium cursor-pointer transition-all border select-none
                ${isCopied
                  ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-400 text-emerald-800 dark:text-emerald-200 shadow-xs'
                  : isManual
                  ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/80 text-blue-900 dark:text-blue-200 hover:border-blue-400'
                  : isMatched
                  ? 'bg-amber-50/90 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 hover:border-amber-400'
                  : isUnverified
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 hover:border-emerald-400 shadow-xs'
                }
              `}
              title={
                detail.originalCandidate
                  ? `Smart Replacement: "${detail.originalCandidate}" → "${detail.value}"`
                  : isManual
                  ? 'Manually added by you (protected)'
                  : detail.matchReason || 'Pinterest Validated'
              }
            >
              {/* Status Badge Icon */}
              {isCopied ? (
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : isManual ? (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0">✎</span>
              ) : isMatched ? (
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : isUnverified ? (
                <Info className="w-3 h-3 text-slate-400 shrink-0" />
              ) : (
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}

              {/* Keyword Text */}
              <span className="font-semibold">{detail.value}</span>

              {/* If Smart Matched, small arrow indication */}
              {isMatched && detail.originalCandidate && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-mono hidden sm:inline">
                  matched
                </span>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(detail.value);
                }}
                className="p-0.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors ml-0.5"
                title={`Remove "${detail.value}"`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {filteredDetails.length === 0 && (
          <div className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
            No keywords matching filter. Click <strong>Generate & Validate</strong> or type below.
          </div>
        )}

        {/* Inline Manual Add Input */}
        <div className="flex items-center gap-1 min-w-[150px] flex-1">
          <input
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={handleAddManualTag}
            placeholder="+ Add Pinterest keyword & press Enter..."
            className="w-full text-xs bg-transparent focus:outline-none px-2 py-1 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
          />
          {newTagInput.trim() && (
            <button
              type="button"
              onClick={() => handleAddManualTag()}
              className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded cursor-pointer"
              title="Add Keyword"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Discarded / Replaced Candidates Inspector */}
      {keywordSummary && keywordSummary.discardedCandidates && keywordSummary.discardedCandidates.length > 0 && (
        <div className="border border-slate-200/70 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowDiscarded(!showDiscarded)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-[11px]">
                Keyword Validation Engine Log: {keywordSummary.discardedCandidates.length} AI candidate phrases filtered or replaced
              </span>
            </div>
            {showDiscarded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDiscarded && (
            <div className="p-3 bg-white dark:bg-slate-900 space-y-2 max-h-48 overflow-y-auto font-mono text-[11px]">
              {keywordSummary.discardedCandidates.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <div className="flex items-start gap-1.5">
                    {d.replacedWith ? (
                      <span className="text-amber-500 font-bold shrink-0">⚠</span>
                    ) : (
                      <span className="text-red-500 font-bold shrink-0">✕</span>
                    )}
                    <div>
                      <span className="line-through text-slate-400">{d.candidate}</span>
                      {d.replacedWith && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1.5">
                          → {d.replacedWith}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 italic">
                    {d.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
