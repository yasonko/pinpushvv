import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  RotateCw, 
  AlertTriangle, 
  Search, 
  Zap, 
  Radio, 
  Sparkles, 
  Command, 
  Stamp, 
  Crop, 
  Globe,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Lock
} from 'lucide-react';
import { PinterestAccount, PublishQueueItem } from '../types';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenUpload: () => void;
  onOpenCsvImport: () => void;
  onExportCsv: () => void;
  onOpenQueue: () => void;
  onOpenCommandPalette: () => void;
  onOpenWatermark: () => void;
  onOpenAspectRatio: () => void;
  onOpenUtmBuilder: () => void;
  queueItems: PublishQueueItem[];
  pinterestAccount: PinterestAccount | null;
  onConnectPinterest: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onOpenUpload,
  onOpenCsvImport,
  onExportCsv,
  onOpenQueue,
  onOpenCommandPalette,
  onOpenWatermark,
  onOpenAspectRatio,
  onOpenUtmBuilder,
  queueItems,
  pinterestAccount,
  onConnectPinterest,
  isDarkMode = false,
  onToggleDarkMode,
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const publishingCount = queueItems.filter(q => q.status === 'publishing' || q.status === 'queued').length;
  const failedCount = queueItems.filter(q => q.status === 'failed').length;

  return (
    <header className="h-16 bg-white/80 dark:bg-black/75 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 transition-colors z-20 sticky top-0">
      {/* Left Group: Sidebar Toggle + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] rounded-xl transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
            title={isSidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar for more space (Ctrl+B)'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4 text-[#E60023]" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}

        {/* Search Bar with Command Palette trigger */}
        <div className="relative w-full flex items-center">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pins or press ⌘K for quick actions..."
            className="w-full pl-10 pr-16 py-2 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/30 focus:border-[#E60023] transition-all font-medium hover:bg-white dark:hover:bg-white/[0.06]"
          />
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.1] text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer shadow-2xs hover:border-slate-300 transition-all active:scale-95"
            title="Open Command Palette (⌘K)"
          >
            <Command className="w-2.5 h-2.5" /> K
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2">
        {/* Dark Mode Toggle Button */}
        {onToggleDarkMode ? (
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2 text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 hover:rotate-12"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to AMOLED Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        ) : null}

        {/* Tools Menu Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowToolsMenu(prev => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
            <span>Power Tools</span>
          </button>

          {showToolsMenu ? (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowToolsMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-60 bg-white/95 dark:bg-black/90 dark:backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.12] p-2 z-30 space-y-1">
                <button
                  type="button"
                  onClick={() => { setShowToolsMenu(false); onOpenWatermark(); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-[#E60023] shrink-0 border border-transparent dark:border-red-900/40">
                    <Stamp className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Watermark & Logo</div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400">Batch stamp domains/logos</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowToolsMenu(false); onOpenAspectRatio(); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 border border-transparent dark:border-blue-900/40">
                    <Crop className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">2:3 Aspect Cropper</div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400">Standardize for Pinterest feed</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setShowToolsMenu(false); onOpenUtmBuilder(); }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-transparent dark:border-emerald-900/40">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">UTM Campaign Builder</div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400">Bulk attach analytics tags</span>
                  </div>
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* Live Publishing Queue Indicator Button */}
        <button
          type="button"
          onClick={onOpenQueue}
          className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer shadow-2xs active:scale-95 ${
            publishingCount > 0
              ? 'bg-red-50 dark:bg-red-950/50 text-[#E60023] dark:text-red-400 border-red-200 dark:border-red-900/60 animate-glow-red'
              : failedCount > 0
              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
              : 'bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] border-slate-200/80 dark:border-white/[0.08]'
          }`}
        >
          {publishingCount > 0 ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin text-[#E60023]" />
              <span>Queue ({publishingCount})</span>
            </>
          ) : failedCount > 0 ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Queue ({failedCount} failed)</span>
            </>
          ) : (
            <>
              <Radio className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Queue</span>
            </>
          )}
        </button>

        {/* CSV Import */}
        <button
          type="button"
          onClick={onOpenCsvImport}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Import Pins from CSV"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Import CSV</span>
        </button>

        {/* CSV Export */}
        <button
          type="button"
          onClick={onExportCsv}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Export Library to CSV"
        >
          <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Export</span>
        </button>

        {/* Cyber Security Lock Trigger */}
        <button
          type="button"
          onClick={() => {
            if ((window as any).lockPinApp) {
              (window as any).lockPinApp();
            } else {
              window.dispatchEvent(new CustomEvent('lock-app'));
            }
          }}
          className="hidden sm:flex items-center gap-1.5 text-xs font-mono font-bold text-red-500/90 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900/50 px-3 py-2 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Lock Console (Requires PIN 2027go on next access or reload)"
        >
          <Lock className="w-3.5 h-3.5 text-[#E60023]" />
          <span>LOCK</span>
        </button>

        {/* Primary Upload CTA Button with Neon Floating Glow */}
        <button
          type="button"
          onClick={onOpenUpload}
          className="relative group flex items-center gap-1.5 bg-[#E60023] hover:bg-[#C8001E] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(230,0,35,0.4)] hover:shadow-[0_0_25px_rgba(230,0,35,0.7)] cursor-pointer active:scale-95 hover:brightness-110 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
          <UploadCloud className="w-3.5 h-3.5 relative z-10 transition-transform group-hover:scale-110" />
          <span className="relative z-10">Upload Pins</span>
        </button>
      </div>
    </header>
  );
};
