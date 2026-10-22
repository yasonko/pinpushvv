import React from 'react';
import { 
  Zap, 
  Check, 
  Sparkles, 
  ExternalLink, 
  FolderHeart, 
  Layers, 
  ChevronRight, 
  ArrowRight,
  Send,
  CalendarClock,
  Clock,
  Radio,
  Terminal,
  Cpu,
  Hash
} from 'lucide-react';
import { Pin, Board, PinterestAccount } from '../../types';
import { openPinterestPinBuilder } from '../../services/clipboardHelper';

interface PinterestDashboardCardProps {
  pinterestAccount?: PinterestAccount | null;
  boards: Board[];
  draftPins: Pin[];
  onPublishPins?: (pins: Pin[]) => void;
  onOpenAutoSchedule: (pins: Pin[]) => void;
  onRefreshAccount?: (account: PinterestAccount | null, boards: Board[]) => void;
  onNavigateToSettings?: () => void;
  onOpenAssistant?: () => void;
}

export const PinterestDashboardCard: React.FC<PinterestDashboardCardProps> = ({
  boards,
  draftPins,
  onOpenAutoSchedule,
  onOpenAssistant,
}) => {
  const readyCount = draftPins.length;

  return (
    <div className="bg-black/85 dark:bg-black/85 backdrop-blur-2xl rounded-3xl border border-red-500/30 p-6 shadow-[0_0_30px_rgba(230,0,35,0.12)] space-y-5 transition-all amoled-card text-white font-mono relative overflow-hidden">
      {/* Background Accent Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(230,0,35,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(230,0,35,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-950/70 text-red-400 flex items-center justify-center font-bold shadow-[0_0_15px_rgba(230,0,35,0.3)] border border-red-500/40">
            <Zap className="w-5 h-5 text-[#E60023]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>MANUAL_COCKPIT</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400 font-mono">
              30-Sec 1-Click Clipboard Pipeline
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openPinterestPinBuilder()}
          className="text-xs font-mono font-bold text-zinc-200 hover:text-white bg-zinc-900/90 hover:bg-zinc-800 px-3 py-2 rounded-xl border border-zinc-700 hover:border-red-500/50 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs"
          title="Open Pinterest Pin Builder in Browser"
        >
          <ExternalLink className="w-3.5 h-3.5 text-[#E60023]" />
          <span>OPEN_BUILDER</span>
        </button>
      </div>

      {/* 3 Step Hacker Workflow Matrix */}
      <div className="relative z-10 space-y-2.5">
        <div className="p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800 flex items-center gap-3 hover:border-red-500/40 transition-colors">
          <span className="w-6 h-6 rounded-full bg-[#E60023] text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0 shadow-[0_0_10px_rgba(230,0,35,0.5)]">
            1
          </span>
          <div className="text-xs">
            <span className="font-bold text-zinc-100">MASS_INGEST & GEMINI_AI</span>
            <p className="text-[11px] text-zinc-400 font-mono">Auto-inject Title, Description, 8-15 Tags, Alt Text.</p>
          </div>
        </div>

        <div className="p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800 flex items-center gap-3 hover:border-blue-500/40 transition-colors">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)]">
            2
          </span>
          <div className="text-xs">
            <span className="font-bold text-zinc-100">CLIPBOARD_INJECTION</span>
            <p className="text-[11px] text-zinc-400 font-mono">1-Click structured fields copied directly to system.</p>
          </div>
        </div>

        <div className="p-3 bg-zinc-950/80 rounded-2xl border border-zinc-800 flex items-center gap-3 hover:border-emerald-500/40 transition-colors">
          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
            3
          </span>
          <div className="text-xs">
            <span className="font-bold text-zinc-100">AUTO_ADVANCE [CTRL+ENTER]</span>
            <p className="text-[11px] text-zinc-400 font-mono">Mark published and instantly jump to next pin.</p>
          </div>
        </div>
      </div>

      {/* Target Board Hash Status */}
      <div className="relative z-10 p-3.5 bg-red-950/30 border border-red-500/30 rounded-2xl flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <FolderHeart className="w-4 h-4 text-[#E60023]" />
          <span className="font-bold text-zinc-200">
            {boards.length} BOARDS_CONFIGURED
          </span>
        </div>
        <span className="font-mono text-[11px] text-red-400 font-bold">
          {readyCount} PAYLOADS_READY
        </span>
      </div>

      {/* Action Triggers */}
      <div className="relative z-10 space-y-2 pt-1 font-mono">
        {onOpenAssistant && (
          <button
            type="button"
            onClick={onOpenAssistant}
            className="w-full bg-gradient-to-r from-[#E60023] via-[#ff1a3c] to-[#cc0020] hover:from-[#ff1a3c] hover:to-[#E60023] text-white font-extrabold text-xs py-3.5 px-4 rounded-2xl shadow-[0_0_20px_rgba(230,0,35,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] border border-red-400/40"
          >
            <Sparkles className="w-4 h-4" />
            <span>OPEN PUBLISHING ASSISTANT</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        )}

        {readyCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenAutoSchedule(draftPins)}
            className="w-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white font-bold text-xs py-3 px-4 rounded-2xl border border-zinc-700 hover:border-blue-500/50 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] shadow-xs"
          >
            <CalendarClock className="w-4 h-4 text-blue-400" />
            <span>AUTO-SCHEDULE ({readyCount})</span>
          </button>
        )}
      </div>
    </div>
  );
};
