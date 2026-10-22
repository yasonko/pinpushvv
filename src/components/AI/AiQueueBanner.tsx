import React, { useState } from 'react';
import { 
  Sparkles, 
  Pause, 
  Play, 
  Square, 
  CheckCircle2, 
  AlertCircle, 
  Eye,
  Tag,
  FileText,
  Type,
  Clock,
  FastForward,
  ChevronDown,
  ChevronUp,
  X,
  RotateCw
} from 'lucide-react';
import { AiQueueState, AiStep } from '../../types';

interface AiQueueBannerProps {
  aiState: AiQueueState;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipCooldown?: () => void;
}

export const AiQueueBanner: React.FC<AiQueueBannerProps> = ({
  aiState,
  onPause,
  onResume,
  onStop,
  onSkipCooldown,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const hasActivity = aiState.isRunning || aiState.isPaused || aiState.queue.length > 0 || (aiState.waitingCountdown !== undefined && aiState.waitingCountdown > 0);

  if (!hasActivity || isDismissed) {
    // If dismissed while running, show a tiny floating indicator button that allows un-hiding
    if (hasActivity && isDismissed) {
      return (
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="fixed bottom-6 right-6 z-40 bg-slate-900 text-white hover:bg-slate-800 border border-slate-700 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold cursor-pointer transition-all hover:scale-105"
          title="Show AI Progress Bar"
        >
          <Sparkles className="w-4 h-4 text-[#E60023] animate-spin" />
          <span>AI Queue ({aiState.processedCount}/{aiState.totalCount})</span>
        </button>
      );
    }
    return null;
  }

  const progressPercent = aiState.totalCount > 0 
    ? Math.round((aiState.processedCount / aiState.totalCount) * 100) 
    : 0;

  const isCooldown = aiState.currentStep === 'waiting_cooldown' || (aiState.waitingCountdown !== undefined && aiState.waitingCountdown > 0);

  const getStepText = (step: AiStep) => {
    const providerName = aiState.currentProvider === 'pollinations' ? 'Pollinations' : 'Gemini';
    const retryAttempt = aiState.currentRetryAttempt && aiState.currentRetryAttempt > 1 ? ` (Attempt ${aiState.currentRetryAttempt})` : '';

    switch (step) {
      case 'waiting':
        return 'Waiting in queue...';
      case 'analyzing':
        return `Analyzing with ${providerName}...`;
      case 'generating_title':
        return `Generating SEO title (${providerName})...`;
      case 'generating_description':
        return `Generating description (${providerName})...`;
      case 'generating_tags':
        return 'Generating Pinterest tagged topics...';
      case 'retrying':
        return `Retrying AI with ${providerName}${retryAttempt}...`;
      case 'saving':
        return 'Saving metadata...';
      case 'waiting_cooldown':
        return `Pacing delay (${aiState.waitingCountdown || 0}s left)...`;
      case 'completed':
      case 'success':
        return `Completed with ${providerName} ✓`;
      case 'failed':
        return 'Failed (skipped to next) ✕';
      default:
        return 'Processing...';
    }
  };

  const getStepIcon = (step: AiStep) => {
    switch (step) {
      case 'analyzing':
        return <Eye className="w-3.5 h-3.5 text-blue-400 animate-pulse" />;
      case 'generating_title':
        return <Type className="w-3.5 h-3.5 text-purple-400 animate-pulse" />;
      case 'generating_description':
        return <FileText className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />;
      case 'generating_tags':
        return <Tag className="w-3.5 h-3.5 text-amber-400 animate-pulse" />;
      case 'waiting_cooldown':
        return <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
      default:
        return <RotateCw className="w-3.5 h-3.5 text-[#E60023] animate-spin" />;
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-md w-full bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700 p-4 transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#E60023] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>Sequential AI Metadata</span>
              {aiState.isPaused ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-medium">
                  Paused
                </span>
              ) : isCooldown ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-medium flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> 15s–30s Pacing
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-medium">
                  Active
                </span>
              )}
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">
              Progress: {aiState.processedCount} / {aiState.totalCount} pins ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Action & Window Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Skip delay button if in cooldown */}
          {isCooldown && onSkipCooldown ? (
            <button
              type="button"
              onClick={onSkipCooldown}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              title="Skip remaining delay and process next image now"
            >
              <FastForward className="w-3 h-3" />
              <span>Skip</span>
            </button>
          ) : null}

          {/* Pause / Resume button */}
          {aiState.isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer transition-colors"
              title="Resume AI Queue"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer transition-colors border border-slate-700"
              title="Pause AI Queue"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {/* Stop / Cancel Queue button */}
          <button
            type="button"
            onClick={onStop}
            className="p-1.5 bg-slate-800 hover:bg-rose-900/70 hover:text-rose-200 text-slate-400 rounded-xl cursor-pointer transition-colors border border-slate-700"
            title="Stop and cancel AI Queue"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsMinimized(prev => !prev)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl cursor-pointer transition-colors border border-slate-700"
            title={isMinimized ? "Expand Process Bar" : "Minimize Process Bar"}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Hide / Dismiss Button */}
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl cursor-pointer transition-colors border border-slate-700"
            title="Hide / Dismiss Process Bar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar (Always visible) */}
      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-red-500 to-[#E60023] h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Expanded body content */}
      {!isMinimized ? (
        <div className="mt-3 space-y-2.5">
          {/* Cooldown delay alert box */}
          {isCooldown ? (
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                <div>
                  <span className="text-amber-200 font-bold text-[11px]">
                    Cooldown: Next pin in {aiState.waitingCountdown}s
                  </span>
                  <p className="text-[10px] text-amber-400/80 font-mono">
                    15s–30s delay between pins to protect rate limits
                  </p>
                </div>
              </div>
              {onSkipCooldown ? (
                <button
                  type="button"
                  onClick={onSkipCooldown}
                  className="text-[10px] bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 px-2 py-1 rounded-lg font-bold cursor-pointer transition-colors shrink-0"
                >
                  Skip ➔
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Current processing item */}
          {aiState.currentFilename && !isCooldown ? (
            <div className="bg-slate-950/60 rounded-2xl p-2.5 border border-slate-800 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 text-[10px]">Analyzing:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800/60 font-sans font-bold">
                    {aiState.currentProvider === 'pollinations' ? 'Pollinations AI' : 'Gemini 3.8'}
                  </span>
                  <span className="text-white font-bold truncate max-w-[150px]">
                    {aiState.currentFilename}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                {getStepIcon(aiState.currentStep)}
                <span className="text-slate-200">{getStepText(aiState.currentStep)}</span>
              </div>
            </div>
          ) : null}

          {/* Status pills summary */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> {aiState.successCount} completed
              </span>
              {aiState.failedCount > 0 ? (
                <span className="flex items-center gap-1 text-rose-400 font-semibold">
                  <AlertCircle className="w-3 h-3" /> {aiState.failedCount} failed
                </span>
              ) : null}
            </div>
            <span>{aiState.queue.length} waiting</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
