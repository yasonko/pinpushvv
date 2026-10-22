import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UploadCloud, 
  Layers, 
  CalendarClock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Clock, 
  Globe, 
  FolderHeart,
  Send,
  Zap,
  Sparkles,
  TrendingUp,
  Terminal,
  Cpu,
  Radio,
  Lock,
  Activity,
  ShieldCheck,
  Flame,
  CornerDownRight,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Hash,
  Database
} from 'lucide-react';
import { Pin, Board, Website, PinterestAccount, ActiveTab } from '../../types';
import { PinterestDashboardCard } from './PinterestDashboardCard';

interface DashboardViewProps {
  pins: Pin[];
  boards: Board[];
  websites: Website[];
  pinterestAccount: PinterestAccount | null;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenUpload: () => void;
  onEditPin: (pin: Pin) => void;
  onOpenAutoSchedule: (pins: Pin[]) => void;
  onPublishPin: (pin: Pin) => void;
  onPublishPins?: (pins: Pin[]) => void;
  onRefreshAccount?: (account: PinterestAccount | null, boards: Board[]) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  pins,
  boards,
  websites,
  pinterestAccount,
  setActiveTab,
  onOpenUpload,
  onEditPin,
  onOpenAutoSchedule,
  onPublishPin,
  onPublishPins,
  onRefreshAccount,
}) => {
  const totalCount = pins.length;
  const readyCount = pins.filter(p => p.status === 'ready' || p.status === 'draft').length;
  const scheduledCount = pins.filter(p => p.status === 'scheduled').length;
  const manualRequiredCount = pins.filter(p => p.status === 'manual_required').length;
  const publishedCount = pins.filter(p => p.status === 'published').length;
  const failedCount = pins.filter(p => p.status === 'failed').length;

  const draftPins = pins.filter(p => p.status === 'draft' || p.status === 'ready');

  // Cyber Telemetry State
  const [latency, setLatency] = useState(14);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    `[SYS] Node Alpha-01 initialized on Port 3000 (TLS 1.3 // AES-GCM-256)`,
    `[AUTH] Reload-Lock defense protocol: ENGAGED [locks automatically on refresh]`,
    `[AI_CORE] Gemini Multi-Modal Engine: STANDBY (Ready for 100+ batch ingest)`,
    `[QUEUE] Active buffers: ${totalCount} payload units (${readyCount} ready for dispatch)`,
  ]);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Live Simulated Latency & Telemetry Jitter
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => Math.max(9, Math.min(32, prev + Math.floor(Math.random() * 5) - 2)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto scroll terminal
  useEffect(() => {
    if (showTerminal) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, showTerminal]);

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = terminalInput.trim().toLowerCase();
    if (!cmd) return;

    const time = new Date().toLocaleTimeString([], { hour12: false });
    let response = '';

    if (cmd === 'help') {
      response = `Commands: help, status, lock, ping, schedule, upload, clear, inspect`;
    } else if (cmd === 'status') {
      response = `STATUS: Buffers=${totalCount} | Ready=${readyCount} | Sched=${scheduledCount} | Pub=${publishedCount} | Latency=${latency}ms`;
    } else if (cmd === 'lock') {
      response = `LOCKING TERMINAL PROTOCOL...`;
      setTimeout(() => {
        if ((window as any).lockPinApp) {
          (window as any).lockPinApp();
        } else {
          window.dispatchEvent(new CustomEvent('lock-app'));
        }
      }, 400);
    } else if (cmd === 'ping') {
      response = `PONG: Gateway response time ${latency}ms (Packet Loss: 0.0%)`;
    } else if (cmd === 'schedule') {
      onOpenAutoSchedule(draftPins);
      response = `TRIGGERED: Auto-schedule interface invoked with ${draftPins.length} ready pins.`;
    } else if (cmd === 'upload') {
      onOpenUpload();
      response = `TRIGGERED: Mass upload modal engaged.`;
    } else if (cmd === 'clear') {
      setTerminalLogs([`[SYS] Console cleared at ${time}`]);
      setTerminalInput('');
      return;
    } else if (cmd === 'inspect') {
      response = `BOARDS=${boards.length} | SITES=${websites.length} | ACCOUNT=${pinterestAccount?.username || 'GUEST'}`;
    } else {
      response = `Command not recognized: '${cmd}'. Type 'help' for valid cyber triggers.`;
    }

    setTerminalLogs(prev => [
      ...prev,
      `[${time}] > ${terminalInput}`,
      `[${time}] ${response}`
    ]);
    setTerminalInput('');
  };

  // Recent uploads (up to 8)
  const recentUploads = [...pins]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  // Upcoming scheduled pins (up to 6)
  const upcomingPins = pins
    .filter(p => p.scheduledAt && p.status === 'scheduled')
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* 1. TOP HACKER TELEMETRY HUD & CYBER DEFENSE STRIP */}
      <div className="bg-black/90 dark:bg-black/90 backdrop-blur-2xl border border-red-500/30 rounded-2xl p-3 sm:px-5 sm:py-3.5 shadow-[0_0_30px_rgba(230,0,35,0.12)] text-white relative overflow-hidden transition-all font-mono">
        {/* Animated Cyber Grid scanline */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(230,0,35,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(230,0,35,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Cyber Node & Latency */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E60023]"></span>
              </span>
              <span className="font-bold text-red-400 tracking-wider text-[11px]">
                OPS_NODE: ALPHA-01
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-zinc-400 text-[11px]">
              <Cpu className="w-3.5 h-3.5 text-red-500" />
              <span>AES-256 // TLS 1.3</span>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>{latency}ms PING</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-red-300/80 text-[11px] bg-red-950/30 border border-red-500/20 px-2 py-0.5 rounded-md">
              <ShieldCheck className="w-3 h-3 text-red-400" />
              <span>RELOAD-LOCK: ENGAGED</span>
            </div>
          </div>

          {/* Right: Hacker Terminal Toggle & Instant Lock */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setShowTerminal(prev => !prev)}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-bold ${
                showTerminal 
                  ? 'bg-red-950/80 border-red-500 text-white shadow-[0_0_12px_rgba(230,0,35,0.4)]' 
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white hover:border-red-500/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-red-400" />
              <span>{showTerminal ? 'CLOSE CONSOLE' : 'CYBER CONSOLE'}</span>
              {showTerminal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if ((window as any).lockPinApp) {
                  (window as any).lockPinApp();
                } else {
                  window.dispatchEvent(new CustomEvent('lock-app'));
                }
              }}
              className="flex items-center gap-1.5 text-[11px] font-bold bg-gradient-to-r from-red-600 to-[#E60023] hover:from-red-500 hover:to-red-600 text-white px-3 py-1 rounded-lg shadow-[0_0_15px_rgba(230,0,35,0.4)] hover:shadow-[0_0_20px_rgba(230,0,35,0.7)] transition-all cursor-pointer border border-red-400/40 active:scale-95"
              title="Lock Terminal Console Immediately"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>LOCK TERMINAL</span>
            </button>
          </div>
        </div>

        {/* Expandable Live Interactive Cyber Terminal */}
        <AnimatePresence>
          {showTerminal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 pt-3 border-t border-red-500/20 text-xs font-mono space-y-2"
            >
              <div className="bg-black/95 p-3 rounded-xl border border-red-500/30 max-h-48 overflow-y-auto space-y-1 text-[11px] shadow-inner font-mono text-zinc-300 select-text">
                {terminalLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={
                      log.includes('[SYS]') ? 'text-zinc-400' :
                      log.includes('[AUTH]') ? 'text-red-400 font-bold' :
                      log.includes('[AI_CORE]') ? 'text-purple-400' :
                      log.includes('TRIGGERED') ? 'text-emerald-400 font-bold' :
                      log.includes('PONG') ? 'text-emerald-300' :
                      log.includes('LOCKING') ? 'text-red-500 font-black' :
                      log.startsWith('[') && log.includes('>') ? 'text-red-300 font-bold' : 'text-zinc-300'
                    }
                  >
                    {log}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {/* Terminal Command Input Form */}
              <form onSubmit={handleTerminalSubmit} className="flex items-center gap-2">
                <span className="text-red-500 font-bold flex items-center gap-1 text-xs">
                  <CornerDownRight className="w-3.5 h-3.5" />
                  <span>root@pinpulse:~#</span>
                </span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder="Type cyber command (help, status, lock, ping, schedule, upload, clear)..."
                  className="flex-1 bg-black/80 border border-red-500/40 rounded-lg px-3 py-1 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/50"
                />
                <button
                  type="submit"
                  className="bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-500/40 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  EXEC
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. CYBER COMMAND HERO DECK */}
      <div className="bg-black/85 dark:bg-black/85 backdrop-blur-2xl border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_40px_rgba(230,0,35,0.15)] relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all amoled-card group text-white font-sans">
        {/* Animated Floating Cyber Glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[#E60023]/[0.18] rounded-full blur-3xl pointer-events-none animate-neon-float-1" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-600/[0.15] rounded-full blur-3xl pointer-events-none animate-neon-float-2" />

        {/* Technical Corner Brackets */}
        <div className="absolute top-2 left-2 text-red-500/40 font-mono text-[9px] pointer-events-none">[+]</div>
        <div className="absolute top-2 right-2 text-red-500/40 font-mono text-[9px] pointer-events-none">[+]</div>
        <div className="absolute bottom-2 left-2 text-red-500/40 font-mono text-[9px] pointer-events-none">[+]</div>
        <div className="absolute bottom-2 right-2 text-red-500/40 font-mono text-[9px] pointer-events-none">[+]</div>

        <div className="space-y-3 max-w-xl z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/70 text-red-400 border border-red-500/40 text-[11px] font-mono font-bold uppercase tracking-widest animate-neon-badge shadow-[0_0_12px_rgba(230,0,35,0.2)]">
            <Zap className="w-3.5 h-3.5 text-[#E60023]" /> 
            <span>BATCH PUBLISHING MATRIX v2.7</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            High-Speed Pin Publisher Terminal
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-mono">
            Execute mass image uploads, neural Gemini AI generation, multi-day scheduling algorithms, and 1-click clipboard pipelines.
          </p>
        </div>

        {/* Big CTAs with Cyber Glow */}
        <div className="z-10 flex flex-col sm:flex-row gap-3 w-full sm:w-auto font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className="relative group/btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_28px_rgba(16,185,129,0.6)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-emerald-400/30"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>AI ASSISTANT</span>
          </button>
          
          <button
            type="button"
            onClick={onOpenUpload}
            className="relative group/btn bg-gradient-to-r from-[#E60023] via-[#ff1a3c] to-[#cc0020] hover:from-[#ff1a3c] hover:to-[#E60023] text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-[0_0_25px_rgba(230,0,35,0.45)] hover:shadow-[0_0_35px_rgba(230,0,35,0.8)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 border border-red-400/40"
          >
            <UploadCloud className="w-4 h-4" />
            <span>MASS INGEST</span>
          </button>

          {readyCount > 0 ? (
            <button
              type="button"
              onClick={() => onOpenAutoSchedule(draftPins)}
              className="bg-black/80 hover:bg-zinc-900 text-blue-400 font-bold text-xs px-4 py-3.5 rounded-2xl border border-blue-500/40 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_0_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] active:scale-95"
            >
              <CalendarClock className="w-4 h-4 text-blue-400" />
              <span>AUTO SCHEDULE ({readyCount})</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* 3. PINTEREST COCKPIT + 6 QUANTUM CYBER KPI NODES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 4 cols: Dedicated Pinterest Manual Cockpit */}
        <div className="lg:col-span-4">
          <PinterestDashboardCard
            boards={boards}
            draftPins={draftPins}
            onOpenAutoSchedule={onOpenAutoSchedule}
            onOpenAssistant={() => setActiveTab('assistant')}
          />
        </div>

        {/* Right 8 cols: 6 Hacker KPI Nodes */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono">
          {/* Node 01: Total Buffer */}
          <motion.div
            whileHover={{ y: -4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('library')}
            className="bg-black/80 dark:bg-black/80 backdrop-blur-xl p-5 rounded-3xl border border-zinc-800 hover:border-zinc-500 shadow-xs hover:shadow-[0_0_20px_rgba(255,255,255,0.08)] transition-all cursor-pointer flex flex-col justify-between group text-white relative overflow-hidden"
          >
            <div className="absolute top-2 right-3 text-[9px] font-mono text-zinc-600 group-hover:text-zinc-400">NODE_01</div>
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">TOTAL BUFFER</span>
              <Layers className="w-4 h-4 text-zinc-400 group-hover:scale-110 group-hover:text-white transition-transform" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-white tracking-tight">{totalCount}</div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Hex: 0x{totalCount.toString(16).toUpperCase().padStart(2, '0')} // Units</span>
            </div>
          </motion.div>

          {/* Node 02: Ready / Staged */}
          <motion.div
            whileHover={{ y: -4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('library')}
            className="bg-black/80 dark:bg-black/80 backdrop-blur-xl p-5 rounded-3xl border border-emerald-500/30 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.12)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex flex-col justify-between group text-white relative overflow-hidden"
          >
            <div className="absolute top-2 right-3 text-[9px] font-mono text-emerald-500/50 group-hover:text-emerald-400">NODE_02</div>
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">DISPATCH READY</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981] animate-pulse" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">{readyCount}</div>
              <span className="text-[10px] text-emerald-500/80 font-mono mt-1 block">Staged for Publishing</span>
            </div>
          </motion.div>

          {/* Node 03: Scheduled Chrono Queue */}
          <motion.div
            whileHover={{ y: -4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('schedule')}
            className="bg-black/80 dark:bg-black/80 backdrop-blur-xl p-5 rounded-3xl border border-blue-500/30 hover:border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.12)] hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all cursor-pointer flex flex-col justify-between group text-white relative overflow-hidden"
          >
            <div className="absolute top-2 right-3 text-[9px] font-mono text-blue-500/50 group-hover:text-blue-400">NODE_03</div>
            <div className="flex items-center justify-between text-blue-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300">CHRONO QUEUE</span>
              <CalendarClock className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-blue-400 tracking-tight">{scheduledCount}</div>
              <span className="text-[10px] text-blue-500/80 font-mono mt-1 block">Auto-Timed Pipeline</span>
            </div>
          </motion.div>

          {/* Node 04: Manual Intercept */}
          <motion.div
            whileHover={{ y: -4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('library')}
            className="bg-black/80 dark:bg-black/80 backdrop-blur-xl p-5 rounded-3xl border border-amber-500/30 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.12)] hover:shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all cursor-pointer flex flex-col justify-between group text-white relative overflow-hidden"
          >
            <div className="absolute top-2 right-3 text-[9px] font-mono text-amber-500/50 group-hover:text-amber-400">NODE_04</div>
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">INTERCEPT REQ</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_#F59E0B]" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-amber-400 tracking-tight">{manualRequiredCount}</div>
              <span className="text-[10px] text-amber-500/80 font-mono mt-1 block">Requires Manual Review</span>
            </div>
          </motion.div>

          {/* Node 05: Published */}
          <motion.div
            whileHover={{ y: -4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('library')}
            className="bg-black/80 dark:bg-black/80 backdrop-blur-xl p-5 rounded-3xl border border-emerald-500/30 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.12)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all cursor-pointer flex flex-col justify-between group text-white relative overflow-hidden"
          >
            <div className="absolute top-2 right-3 text-[9px] font-mono text-emerald-500/50 group-hover:text-emerald-400">NODE_05</div>
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">PUBLISHED</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight">{publishedCount}</div>
              <span className="text-[10px] text-emerald-500/80 font-mono mt-1 block">Live on Pinterest Graph</span>
            </div>
          </motion.div>

          {/* Node 06: Anomalies / Failed */}
          <motion.div
            whileHover={{ y: -4, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('library')}
            className="bg-black/80 dark:bg-black/80 backdrop-blur-xl p-5 rounded-3xl border border-red-500/30 hover:border-red-400 shadow-[0_0_15px_rgba(244,63,94,0.15)] hover:shadow-[0_0_25px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex flex-col justify-between group text-white relative overflow-hidden"
          >
            <div className="absolute top-2 right-3 text-[9px] font-mono text-red-500/50 group-hover:text-red-400">NODE_06</div>
            <div className="flex items-center justify-between text-red-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">ANOMALIES</span>
              <AlertCircle className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="text-3xl font-black font-mono text-red-400 tracking-tight">{failedCount}</div>
              <span className="text-[10px] text-red-500/80 font-mono mt-1 block">Requires Quarantine/Retry</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 4. CYBER INGEST MATRIX + CHRONO SCHEDULE RADAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Ingest Matrix (7 cols) */}
        <div className="lg:col-span-7 bg-black/80 dark:bg-black/80 backdrop-blur-2xl p-6 rounded-3xl border border-red-500/30 shadow-[0_0_30px_rgba(230,0,35,0.1)] flex flex-col justify-between transition-all amoled-card text-white">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black font-mono text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#E60023]" />
                  <span>INGEST_BUFFER_MATRIX</span>
                  <span className="text-[10px] text-red-400 font-mono font-medium">({pins.length} payloads)</span>
                </h3>
                <p className="text-xs font-mono text-zinc-400">Click payload unit to inspect and inject metadata</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className="text-xs font-mono font-bold text-red-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>OPEN_LIBRARY</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentUploads.length === 0 ? (
              <div className="p-8 text-center bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-2">
                <p className="text-xs font-mono text-zinc-400 font-medium">Zero payloads currently in ingest queue.</p>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="text-xs font-mono font-bold text-red-400 hover:text-white hover:underline cursor-pointer"
                >
                  EXECUTE INGEST PROTOCOL →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {recentUploads.map((pin, i) => (
                  <div
                    key={pin.id}
                    onClick={() => onEditPin(pin)}
                    className="group bg-zinc-950/80 rounded-2xl overflow-hidden border border-zinc-800 hover:border-red-500/60 cursor-pointer transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:shadow-[0_0_18px_rgba(230,0,35,0.25)] active:scale-95 relative"
                  >
                    <div className="aspect-[2/3] overflow-hidden bg-black relative">
                      <img
                        src={pin.thumbnailUrl || pin.imageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {pin.aiStatus === 'completed' && (
                        <span className="absolute top-1.5 right-1.5 bg-emerald-600/90 text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs border border-emerald-400/40">
                          AI DONE
                        </span>
                      )}
                      <span className="absolute bottom-1 left-1.5 bg-black/80 backdrop-blur-xs text-[8px] font-mono text-zinc-400 px-1 rounded">
                        #{String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="p-2.5 font-mono">
                      <p className="text-[11px] font-bold text-zinc-200 truncate group-hover:text-red-400 transition-colors">
                        {pin.title || pin.filename}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-500">
            <span>FORMATS: JPG, PNG, WEBP, GIF, MP4</span>
            <span className="text-red-400/80 text-[11px]">BENTO PIPELINE: ONLINE</span>
          </div>
        </div>

        {/* Right: Chrono Schedule Stream (5 cols) */}
        <div className="lg:col-span-5 bg-black/80 dark:bg-black/80 backdrop-blur-2xl p-6 rounded-3xl border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)] flex flex-col justify-between transition-all amoled-card text-white">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black font-mono text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>CHRONO_DISPATCH_QUEUE</span>
                </h3>
                <p className="text-xs font-mono text-zinc-400">Automated multi-date queue calendar</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="text-xs font-mono font-bold text-blue-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>CALENDAR</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingPins.length === 0 ? (
              <div className="p-8 text-center bg-zinc-950/80 rounded-2xl border border-zinc-800 space-y-2">
                <p className="text-xs font-mono text-zinc-400 font-medium">No chrono-timed pins queued.</p>
                <button
                  type="button"
                  onClick={() => onOpenAutoSchedule(pins)}
                  className="text-xs font-mono font-bold text-blue-400 hover:text-white hover:underline cursor-pointer"
                >
                  DISPATCH AUTO-SCHEDULE DAEMON →
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 font-mono">
                {upcomingPins.map((pin) => {
                  const targetBoard = boards.find(b => b.id === pin.boardId);
                  const scheduleDate = pin.scheduledAt ? new Date(pin.scheduledAt) : null;

                  return (
                    <div
                      key={pin.id}
                      onClick={() => onEditPin(pin)}
                      className="p-2.5 bg-zinc-950/80 hover:bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-blue-500/50 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={pin.thumbnailUrl || pin.imageUrl}
                          alt=""
                          className="w-8 h-12 rounded-lg object-cover bg-black shrink-0 border border-zinc-700"
                        />
                        <div className="min-w-0 font-mono">
                          <p className="text-xs font-bold text-zinc-200 truncate">
                            {pin.title || pin.filename}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            BOARD: {targetBoard?.name || 'ROOT'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        <span className="text-[11px] font-bold text-blue-400 block">
                          {scheduleDate?.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          {scheduleDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => onOpenAutoSchedule(pins)}
              className="w-full text-xs font-mono font-bold text-blue-400 bg-blue-950/40 hover:bg-blue-900/50 py-2.5 rounded-xl border border-blue-500/40 cursor-pointer transition-colors text-center active:scale-95 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
            >
              CONFIGURE CHRONO-INTERVALS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
