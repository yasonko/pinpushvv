import React from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  FileText, 
  Sliders, 
  Cpu, 
  Info,
  Check,
  Hash
} from 'lucide-react';
import { 
  ImageCleanerSettings, 
  OutputFormat, 
  RenameMode, 
  ResizeMode 
} from '../../types/imageCleaner';

interface SettingsPanelProps {
  settings: ImageCleanerSettings;
  onUpdateSettings: (newSettings: Partial<ImageCleanerSettings>) => void;
  disabled?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  disabled = false,
}) => {
  // Live sample filename preview
  const getPreviewFilename = (): string => {
    const ext = settings.outputFormat === 'png' ? '.png' : settings.outputFormat === 'webp' ? '.webp' : '.jpg';
    if (!settings.enableRename) return `sample-original-name${ext}`;

    const num = String(settings.startNumber).padStart(settings.paddingDigits || 3, '0');
    let kw = (settings.keyword || 'matcha-latte').trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    if (settings.lowercase) kw = kw.toLowerCase();

    switch (settings.renameMode) {
      case 'seo':
        return `${kw}-${num}${ext}`;
      case 'prefix':
        return `${settings.prefix || 'recipe'}-${num}${ext}`;
      case 'random':
        return `pin-a73f92${ext}`;
      case 'template':
        return (settings.template || '{keyword}-{number}')
          .replace(/\{keyword\}/gi, kw)
          .replace(/\{number\}/gi, num)
          .replace(/\{name\}/gi, 'photo') + ext;
      default:
        return `${kw}-${num}${ext}`;
    }
  };

  return (
    <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-white/[0.08] p-5 space-y-6 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-white/[0.08]">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Processing & Normalization Rules
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure metadata removal policies, image re-encoding, and file naming
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Metadata Cleaning Policies */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>Privacy & Metadata Stripping</span>
          </div>

          <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.02] p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeGps}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeGps: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove GPS & Location Data</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeCamera}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeCamera: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Camera Make, Model & Lens</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeMakerNotes}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeMakerNotes: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Maker Notes & Proprietary Blocks</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeDateTime}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeDateTime: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Date & Time Timestamps</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeUniqueIds}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeUniqueIds: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Unique IDs & Serial Numbers</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeThumbnails}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeThumbnails: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Embedded Thumbnails</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeFaceRegions}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeFaceRegions: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Face & Person Region Tags</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeSoftwareHistory}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeSoftwareHistory: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Software & Editing History</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeKeywordsTags}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeKeywordsTags: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Keywords & Subject Tags</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeRatingLabels}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeRatingLabels: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Rating & Label Metadata</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeIptcPersonal}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeIptcPersonal: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Personal IPTC (Creator, City)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeXmpPersonal}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeXmpPersonal: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove XMP Personal Tags</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.removeCopyright}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeCopyright: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove Copyright & Contact Metadata</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer pt-1 border-t border-slate-200/60 dark:border-white/[0.08]">
              <input
                type="checkbox"
                checked={settings.removeICCProfile}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ removeICCProfile: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Remove ICC / Color Profile</span>
            </label>
          </div>
        </div>

        {/* 2. Image Normalizer & Compression */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Image Normalizer & Quality</span>
          </div>

          <div className="space-y-3 text-xs bg-slate-50 dark:bg-white/[0.02] p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
            {/* Output Format */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Output Format
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['original', 'jpeg', 'png', 'webp'] as OutputFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    disabled={disabled}
                    onClick={() => onUpdateSettings({ outputFormat: fmt })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                      settings.outputFormat === fmt
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    {fmt === 'original' ? 'Keep Original' : fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* JPEG Quality */}
            {settings.outputFormat !== 'png' && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  <span>Compression Quality</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{settings.jpegQuality}%</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={100}
                  step={1}
                  disabled={disabled}
                  value={settings.jpegQuality}
                  onChange={(e) => onUpdateSettings({ jpegQuality: Number(e.target.value) })}
                  className="w-full accent-[#E60023] cursor-pointer"
                />
              </div>
            )}

            {/* Resize Mode */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Resize Resolution
              </label>
              <select
                disabled={disabled}
                value={settings.resizeMode}
                onChange={(e) => onUpdateSettings({ resizeMode: e.target.value as ResizeMode })}
                className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-black/80 border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="original">Original Dimensions (No Resize)</option>
                <option value="1000x1500">1000 × 1500 px (Pinterest 2:3 Optimal)</option>
                <option value="custom">Custom Dimensions</option>
              </select>
            </div>

            {/* Preserve Aspect Ratio */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={settings.preserveAspectRatio}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ preserveAspectRatio: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Strictly preserve aspect ratio (Prevent distortion)
              </span>
            </label>
          </div>
        </div>

        {/* 3. Filename Generator */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <FileText className="w-4 h-4 text-blue-500" />
            <span>SEO Filename Pattern</span>
          </div>

          <div className="space-y-3 text-xs bg-slate-50 dark:bg-white/[0.02] p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.06]">
            {/* Enable Rename */}
            <label className="flex items-center gap-2 cursor-pointer pb-1 border-b border-slate-200/60 dark:border-white/[0.08]">
              <input
                type="checkbox"
                checked={settings.enableRename}
                disabled={disabled}
                onChange={(e) => onUpdateSettings({ enableRename: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Enable Auto-Renaming
              </span>
            </label>

            {settings.enableRename && (
              <>
                {/* Mode */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Naming Mode
                  </label>
                  <select
                    disabled={disabled}
                    value={settings.renameMode}
                    onChange={(e) => onUpdateSettings({ renameMode: e.target.value as RenameMode })}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-black/80 border border-slate-200 dark:border-white/[0.08] text-xs font-medium text-slate-800 dark:text-slate-200"
                  >
                    <option value="seo">SEO Descriptive (keyword-001)</option>
                    <option value="prefix">Prefix Mode (recipe-001)</option>
                    <option value="random">Random Unique Hash (pin-a73f92)</option>
                    <option value="template">Custom Template Pattern</option>
                  </select>
                </div>

                {/* Keyword / Pattern input */}
                {settings.renameMode === 'seo' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      SEO Topic / Keyword
                    </label>
                    <input
                      type="text"
                      disabled={disabled}
                      value={settings.keyword}
                      onChange={(e) => onUpdateSettings({ keyword: e.target.value })}
                      placeholder="e.g. strawberry-matcha-latte"
                      className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-black/80 border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}

                {settings.renameMode === 'prefix' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Filename Prefix
                    </label>
                    <input
                      type="text"
                      disabled={disabled}
                      value={settings.prefix}
                      onChange={(e) => onUpdateSettings({ prefix: e.target.value })}
                      placeholder="e.g. recipe"
                      className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-black/80 border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}

                {settings.renameMode === 'template' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Pattern Template
                    </label>
                    <input
                      type="text"
                      disabled={disabled}
                      value={settings.template}
                      onChange={(e) => onUpdateSettings({ template: e.target.value })}
                      placeholder="{keyword}-{number}"
                      className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-black/80 border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-slate-800 dark:text-slate-200"
                    />
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      Tags: {'{keyword}'}, {'{number}'}, {'{name}'}
                    </div>
                  </div>
                )}

                {/* Live Preview */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.08]">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Output Preview:
                  </div>
                  <div className="px-2 py-1 bg-white dark:bg-black/80 rounded border border-slate-200 dark:border-white/[0.08] font-mono text-[11px] text-indigo-600 dark:text-indigo-400 truncate">
                    {getPreviewFilename()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
