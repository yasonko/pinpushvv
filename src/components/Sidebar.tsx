import React from 'react';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Layers, 
  Settings, 
  Zap, 
  Lock,
  Sun,
  Moon,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Stamp
} from 'lucide-react';
import { ActiveTab, PinterestAccount } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  totalPinsCount: number;
  draftsCount: number;
  scheduledCount?: number;
  assistantCount?: number;
  pinterestAccount: PinterestAccount | null;
  onOpenUpload: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  totalPinsCount,
  draftsCount,
  scheduledCount,
  assistantCount,
  pinterestAccount,
  onOpenUpload,
  isDarkMode = false,
  onToggleDarkMode,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }>; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assistant', label: 'Publish Assistant', icon: Zap, count: assistantCount },
    { id: 'upload', label: 'Upload Pins', icon: UploadCloud },
    { id: 'ebook', label: 'eBook Builder', icon: BookOpen },
    { id: 'cleaner', label: 'Image Cleaner', icon: ShieldCheck },
    { id: 'watermark', label: 'Watermark PNG', icon: Stamp },
    { id: 'library', label: 'Pin Library', icon: Layers, count: totalPinsCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-20 p-3' : 'w-64 p-4'
      } bg-white/90 dark:bg-black/80 dark:backdrop-blur-2xl border-r border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between shrink-0 transition-all duration-300 select-none relative z-20`}
    >
      <div className="space-y-6">
        {/* Brand Logo Bento Header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-1.5 pt-1`}>
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
            title="PinPulse Pinterest Publisher"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E60023] hover:bg-[#C8001E] flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform relative group-hover:shadow-[0_0_16px_rgba(230,0,35,0.6)]">
              <div className="absolute inset-0 rounded-xl bg-[#E60023] opacity-40 blur-md group-hover:opacity-75 transition-opacity" />
              <svg
                className="w-4.5 h-4.5 fill-current relative z-10"
                viewBox="0 0 24 24"
              >
                <path d="M12 0a12 12 0 0 0-4.37 23.18c-.05-.98-.1-2.48.02-3.55l.7-6.02s-.18-.35-.18-.88c0-.82.48-1.44 1.08-1.44.51 0 .76.38.76.84 0 .51-.33 1.28-.5 1.99-.14.6.3 1.09.89 1.09 1.07 0 1.9-.96 1.9-2.35 0-1.23-.88-2.09-2.14-2.09-1.57 0-2.48 1.17-2.48 2.39 0 .47.18.98.41 1.26.05.05.05.1.04.18l-.16.64c-.02.1-.09.13-.2.08-1.02-.48-1.66-1.97-1.66-3.17 0-2.58 1.88-4.96 5.42-4.96 2.84 0 5.06 2.03 5.06 4.74 0 2.83-1.78 5.1-4.26 5.1-.83 0-1.61-.43-1.88-.94l-.51 1.95c-.19.71-.69 1.6-1.03 2.15A11.98 11.98 0 0 0 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z" />
              </svg>
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                  PINPULSE
                </h1>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium tracking-wide mt-0.5 block">
                  Mass Publishing Pro
                </span>
              </div>
            )}
          </div>

          {/* Collapse / Expand Toggle Button */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`p-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all cursor-pointer active:scale-95 ${
                isCollapsed ? 'hidden' : 'block'
              }`}
              title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar for more space (Ctrl+B)'}
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? `${item.label} ${item.count !== undefined && item.count > 0 ? `(${item.count})` : ''}` : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                } rounded-xl text-xs font-bold transition-all cursor-pointer relative group active:scale-[0.98] ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-sidebar-tab"
                    className="absolute inset-0 bg-[#E60023] rounded-xl shadow-[0_0_18px_rgba(230,0,35,0.45)] dark:shadow-[0_0_24px_rgba(230,0,35,0.6)]"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}

                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} relative z-10`}>
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`} />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>

                {!isCollapsed && item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold relative z-10 transition-colors ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.count}
                  </span>
                )}

                {/* Collapsed Count Badge */}
                {isCollapsed && item.count !== undefined && item.count > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E60023] text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center shadow-xs z-20">
                    {item.count > 99 ? '99+' : item.count}
                  </span>
                )}

                {/* Tooltip on Hover when Collapsed */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 dark:bg-black/90 dark:backdrop-blur-xl border border-transparent dark:border-white/[0.12] text-white text-xs font-bold rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                    {item.label}
                    {item.count !== undefined && item.count > 0 && (
                      <span className="ml-1.5 opacity-70 font-mono">({item.count})</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Collapse Toggle Bar for Compact Mode */}
      {isCollapsed && onToggleCollapse && (
        <div className="my-2 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer active:scale-95"
            title="Expand Sidebar (Ctrl+B)"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Account / Network Status Footer Tile */}
      <div className={`mt-auto pt-4 border-t border-slate-200/80 dark:border-white/[0.08] ${isCollapsed ? 'space-y-2 text-center' : 'space-y-3'}`}>
        {!isCollapsed ? (
          <div className="bg-slate-50 dark:bg-white/[0.03] dark:backdrop-blur-md p-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3 shadow-2xs">
            {pinterestAccount?.isConnected ? (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  {pinterestAccount.avatarUrl ? (
                    <img
                      src={pinterestAccount.avatarUrl}
                      alt={pinterestAccount.username}
                      className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-white/[0.1]"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-[#E60023] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                      {pinterestAccount.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      @{pinterestAccount.username}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>API Connected</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2.5 cursor-pointer flex-1 group"
              >
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#E60023] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#E60023] transition-colors">No Account</p>
                  <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold">Click to connect</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1">
              {onToggleDarkMode && (
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="p-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.08] rounded-xl cursor-pointer transition-colors active:scale-95"
                  title={isDarkMode ? 'Light Mode' : 'AMOLED Dark Mode'}
                >
                  {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if ((window as any).lockPinApp) {
                    (window as any).lockPinApp();
                  } else {
                    window.dispatchEvent(new CustomEvent('lock-app'));
                  }
                }}
                className="p-1.5 text-red-500/80 hover:text-red-400 hover:bg-red-950/40 rounded-xl cursor-pointer transition-colors active:scale-95 border border-transparent hover:border-red-500/30"
                title="Lock Terminal Console (Auto-locks on every reload)"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Collapsed mini profile / lock button */
          <div className="flex flex-col items-center gap-2">
            {pinterestAccount?.isConnected ? (
              <div 
                onClick={() => setActiveTab('settings')}
                className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center cursor-pointer border border-emerald-200 dark:border-emerald-800 hover:scale-105 transition-transform"
                title={`Connected: @${pinterestAccount.username}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#E60023] flex items-center justify-center cursor-pointer border border-red-200 dark:border-red-800/60 hover:scale-105 transition-transform"
                title="Connect Pinterest Account"
              >
                <Zap className="w-4 h-4" />
              </button>
            )}

            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-xl cursor-pointer transition-colors active:scale-95"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to AMOLED Dark Mode'}
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
