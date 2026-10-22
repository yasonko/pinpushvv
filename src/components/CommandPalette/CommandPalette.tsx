import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UploadCloud, 
  CalendarClock, 
  Stamp, 
  Crop, 
  Globe, 
  FolderHeart, 
  FileSpreadsheet, 
  Download, 
  TrendingUp, 
  Layers, 
  Settings, 
  Zap,
  ArrowRight,
  X,
  ShieldCheck
} from 'lucide-react';
import { ActiveTab } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onOpenUpload: () => void;
  onOpenAutoSchedule: () => void;
  onOpenWatermark: () => void;
  onOpenAspectRatio: () => void;
  onOpenUtmBuilder: () => void;
  onExportCsv: () => void;
  onOpenCsvImport: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenUpload,
  onOpenAutoSchedule,
  onOpenWatermark,
  onOpenAspectRatio,
  onOpenUtmBuilder,
  onExportCsv,
  onOpenCsvImport,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'upload',
      title: 'Mass Upload Images',
      subtitle: 'Drag and drop 50+ pins with instant thumbnail extraction',
      icon: UploadCloud,
      action: () => { onOpenUpload(); onClose(); },
      badge: 'Action',
    },
    {
      id: 'image-cleaner',
      title: 'Bulk Image Metadata Cleaner & Normalizer',
      subtitle: 'Strip EXIF/GPS/IPTC metadata, normalize resolution, and SEO rename',
      icon: ShieldCheck,
      action: () => { onNavigate('cleaner'); onClose(); },
      badge: 'Privacy & SEO',
    },
    {
      id: 'auto-schedule',
      title: 'Auto-Schedule Pins',
      subtitle: 'Evenly distribute unscheduled pins across target dates',
      icon: CalendarClock,
      action: () => { onOpenAutoSchedule(); onClose(); },
      badge: 'Scheduler',
    },
    {
      id: 'watermark',
      title: 'Bulk Watermark PNG Studio',
      subtitle: 'Stamp transparent PNG logos or anti-theft tiled pattern across images with lossless PNG ZIP export',
      icon: Stamp,
      action: () => { onNavigate('watermark'); onClose(); },
      badge: 'Tool',
    },
    {
      id: 'aspect-ratio',
      title: 'Pinterest 2:3 Aspect Ratio Optimizer',
      subtitle: 'Smart crop or pad pins to 1000x1500 px standard',
      icon: Crop,
      action: () => { onOpenAspectRatio(); onClose(); },
      badge: 'SEO',
    },
    {
      id: 'utm-builder',
      title: 'Bulk UTM Tracking Builder',
      subtitle: 'Attach GA4 & Shopify tracking tags to destination URLs',
      icon: Globe,
      action: () => { onOpenUtmBuilder(); onClose(); },
      badge: 'Analytics',
    },
    {
      id: 'export-csv',
      title: 'Export Library as CSV',
      subtitle: 'Download complete pin repository spreadsheet',
      icon: Download,
      action: () => { onExportCsv(); onClose(); },
      badge: 'Export',
    },
    {
      id: 'import-csv',
      title: 'Import Pins from CSV',
      subtitle: 'Bulk upload pin titles, URLs, and board mapping',
      icon: FileSpreadsheet,
      action: () => { onOpenCsvImport(); onClose(); },
      badge: 'Import',
    },
    {
      id: 'nav-analytics',
      title: 'Go to Analytics & Reach',
      subtitle: 'View impressions, repins, and CTR metrics',
      icon: TrendingUp,
      action: () => { onNavigate('analytics'); onClose(); },
      badge: 'Navigate',
    },
    {
      id: 'nav-library',
      title: 'Go to Pin Library',
      subtitle: 'Dense grid and table management',
      icon: Layers,
      action: () => { onNavigate('library'); onClose(); },
      badge: 'Navigate',
    },
    {
      id: 'nav-boards',
      title: 'Go to Pinterest Boards',
      subtitle: 'Sync and manage destination boards',
      icon: FolderHeart,
      action: () => { onNavigate('boards'); onClose(); },
      badge: 'Navigate',
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      subtitle: 'Configure Pinterest API token & timezones',
      icon: Settings,
      action: () => { onNavigate('settings'); onClose(); },
      badge: 'Navigate',
    },
  ];

  const filtered = actions.filter(a => 
    (a.title || '').toLowerCase().includes((query || '').toLowerCase().trim()) || 
    (a.subtitle || '').toLowerCase().includes((query || '').toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center pt-20 p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden flex flex-col transition-colors">
        {/* Search input header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-[#F7F7F9] dark:bg-slate-950">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or feature... (e.g. watermark, schedule, crop)"
            autoFocus
            className="w-full text-xs font-semibold bg-transparent text-slate-900 dark:text-white focus:outline-none placeholder-slate-400 dark:placeholder-slate-500"
          />
          <span className="text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 px-2 py-0.5 rounded-md font-bold">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              No matching commands found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  className="p-3 hover:bg-[#F7F7F9] dark:hover:bg-slate-800/60 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#E60023] dark:text-red-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#E60023] dark:group-hover:text-red-400">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg shrink-0">
                    {item.badge}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
