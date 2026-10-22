import React, { useState, useEffect, useRef } from 'react';
import { PdfSettings, CoverThemeType, EbookImageItem } from '../../types/ebook';
import { COVER_THEMES_CATALOG, generateEbookCoverCanvas } from '../../services/ebook/coverGenerator';
import { 
  Palette, 
  Eye, 
  ZoomIn, 
  Ban, 
  Sparkles, 
  BookOpen, 
  Check, 
  RefreshCw, 
  Sliders, 
  FileText, 
  Maximize2, 
  X,
  Layers,
  Crown,
  CheckCircle2
} from 'lucide-react';

interface EbookCoverDesignerProps {
  settings: PdfSettings;
  onChange: (updated: Partial<PdfSettings>) => void;
  sampleImage?: EbookImageItem;
}

export const EbookCoverDesigner: React.FC<EbookCoverDesignerProps> = ({
  settings,
  onChange,
  sampleImage,
}) => {
  const currentTheme: CoverThemeType = settings.generateCover 
    ? (settings.coverTheme || 'modern') 
    : 'none';

  // Preview state
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  
  // Customizable preview sample texts
  const [previewTitle, setPreviewTitle] = useState(
    settings.namingPrefix ? `${settings.namingPrefix} Volume #1` : 'Digital Collector Edition'
  );
  const [previewSubtitle, setPreviewSubtitle] = useState('Curated High-Quality Printable Collection');
  const [authorName, setAuthorName] = useState(settings.authorName || 'Creative Studio');

  const renderTimeoutRef = useRef<any>(null);

  // Re-generate preview when theme, sample image, or texts change
  useEffect(() => {
    if (currentTheme === 'none' || !settings.generateCover) {
      setPreviewDataUrl(null);
      return;
    }

    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    setIsRendering(true);
    renderTimeoutRef.current = setTimeout(async () => {
      try {
        const dataUrl = await generateEbookCoverCanvas({
          title: previewTitle || 'Curated eBook Collection',
          subtitle: previewSubtitle || 'High-Resolution Curated Pages',
          author: authorName || settings.authorName,
          theme: currentTheme,
          sampleImage: sampleImage,
          width: 800,
          height: 1131, // Standard A4 portrait aspect
        });
        setPreviewDataUrl(dataUrl);
      } catch (err) {
        console.warn('[CoverDesigner] Live preview render error:', err);
      } finally {
        setIsRendering(false);
      }
    }, 120);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [currentTheme, settings.generateCover, sampleImage, previewTitle, previewSubtitle, authorName, settings.authorName]);

  const handleSelectTheme = (themeId: CoverThemeType) => {
    if (themeId === 'none') {
      onChange({
        generateCover: false,
        coverTheme: 'none',
        addCoverAsFirstPage: false,
      });
    } else {
      onChange({
        generateCover: true,
        coverTheme: themeId,
        addCoverAsFirstPage: true,
      });
    }
  };

  const handleAuthorChange = (newAuthor: string) => {
    setAuthorName(newAuthor);
    onChange({ authorName: newAuthor });
  };

  return (
    <div id="ebook-cover-designer-panel" className="bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 rounded-xl shadow-2xs">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">eBook Cover Design & Live Preview</h4>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100/70 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/60">
                10 Styles Available
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a professional cover theme, preview in real time, or choose direct-to-content without a cover.
            </p>
          </div>
        </div>

        {/* Quick No-Cover Switch */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectTheme(currentTheme === 'none' ? 'modern' : 'none')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
              currentTheme === 'none'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-900/60 shadow-2xs'
                : 'bg-white dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.1]'
            }`}
          >
            {currentTheme === 'none' ? (
              <>
                <Ban className="w-3.5 h-3.5 text-rose-500" />
                <span>No Cover (Active)</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Switch to No Cover</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Left Theme Cards, Right Live 3D Book Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Theme Picker Grid (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Select Cover Theme</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Current: <strong className="text-slate-800 dark:text-slate-200">{COVER_THEMES_CATALOG.find(t => t.id === currentTheme)?.name || 'Modern Tech'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {COVER_THEMES_CATALOG.map((theme) => {
              const isSelected = currentTheme === theme.id;
              const isNone = theme.id === 'none';

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 text-xs group ${
                    isSelected
                      ? isNone
                        ? 'border-rose-400 dark:border-rose-600 bg-rose-50/70 dark:bg-rose-950/30 shadow-xs ring-2 ring-rose-400/20'
                        : 'border-indigo-500 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xs ring-2 ring-indigo-500/20'
                      : 'border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/[0.14] hover:bg-slate-50/80 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center gap-2">
                      {/* Theme color swatch */}
                      <div 
                        className={`w-4 h-4 rounded-full border border-black/10 shrink-0 flex items-center justify-center`}
                        style={{ backgroundColor: isNone ? '#cbd5e1' : theme.accentColor }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {theme.name}
                      </div>
                    </div>

                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 shrink-0">
                      {theme.category}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {theme.description}
                  </p>

                  {/* Selected Indicator Pill */}
                  {isSelected && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 pt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-indigo-500" />
                      <span>Active Style</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Additional Cover Settings Toggles */}
          <div className="p-3 bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.07] rounded-xl space-y-2.5 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Cover Placement & Metadata</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Author / Publication Brand</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => handleAuthorChange(e.target.value)}
                  placeholder="e.g., Studio Series"
                  disabled={currentTheme === 'none'}
                  className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 block mb-1">Cover Placement</label>
                <label className={`flex items-center gap-2 cursor-pointer ${currentTheme === 'none' ? 'opacity-40 pointer-events-none' : ''}`}>
                  <input
                    type="checkbox"
                    checked={settings.addCoverAsFirstPage && currentTheme !== 'none'}
                    onChange={(e) => onChange({ addCoverAsFirstPage: e.target.checked })}
                    disabled={currentTheme === 'none'}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Include cover inside PDF document (Page 1)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Live 3D Book Preview (5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-4 bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-white/[0.08] rounded-xl shadow-2xs relative">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Real-Time Cover Preview</span>
              </div>

              {previewDataUrl && currentTheme !== 'none' && (
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 rounded-md border border-indigo-200/60 dark:border-indigo-900/40"
                  title="Enlarge Cover Preview"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Enlarge</span>
                </button>
              )}
            </div>

            {/* Book Mockup Canvas Area */}
            <div className="w-full flex items-center justify-center py-2 min-h-[300px]">
              {currentTheme === 'none' ? (
                // State when "No Cover" is chosen
                <div className="text-center p-6 border-2 border-dashed border-slate-200 dark:border-white/[0.1] rounded-2xl w-full max-w-[260px] bg-slate-50/60 dark:bg-white/[0.02]">
                  <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center mb-3 border border-rose-200/80 dark:border-rose-900/40">
                    <Ban className="w-6 h-6" />
                  </div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                    No Cover Selected
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                    Your generated PDF document will begin immediately on Page 1 with your content images.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('modern')}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Enable a Styled Cover
                  </button>
                </div>
              ) : isRendering && !previewDataUrl ? (
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs font-medium">Rendering cover mockup...</span>
                </div>
              ) : previewDataUrl ? (
                // Realistic 3D Book Mockup
                <div className="relative group perspective-1000">
                  <div className="relative rounded-lg shadow-xl shadow-slate-900/20 dark:shadow-black/60 overflow-hidden border border-slate-200/80 dark:border-white/[0.1] transition-transform duration-300 hover:scale-[1.02]">
                    {/* Realistic 3D Book Spine Overlay (left sheen) */}
                    <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 via-white/15 to-transparent pointer-events-none z-10" />
                    
                    {/* Cover image */}
                    <img
                      src={previewDataUrl}
                      alt="eBook Cover Live Preview"
                      className="w-[220px] sm:w-[240px] h-auto object-cover block select-none pointer-events-none"
                    />

                    {/* Subtle page edge shadow */}
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-l from-black/20 to-transparent pointer-events-none" />
                  </div>

                  {/* Reflection / Ground drop shadow effect */}
                  <div className="w-[85%] h-3 mx-auto mt-2 bg-black/15 dark:bg-black/50 blur-md rounded-full" />
                </div>
              ) : null}
            </div>
          </div>

          {/* Quick Preview Text Inputs */}
          {currentTheme !== 'none' && (
            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">Preview Title & Subtitle</span>
                <span className="text-[10px] text-slate-400">Updates mock in real time</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={previewTitle}
                  onChange={(e) => setPreviewTitle(e.target.value)}
                  placeholder="Cover Title"
                  className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/[0.08] rounded-md px-2 py-1 text-[11px] text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={previewSubtitle}
                  onChange={(e) => setPreviewSubtitle(e.target.value)}
                  placeholder="Subtitle text"
                  className="bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/[0.08] rounded-md px-2 py-1 text-[11px] text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Zoom Modal */}
      {isZoomOpen && previewDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setIsZoomOpen(false)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 max-h-[80vh] flex items-center justify-center bg-black">
              <img
                src={previewDataUrl}
                alt="eBook Cover High-Res Preview"
                className="max-h-[80vh] w-auto object-contain"
              />
            </div>

            <div className="text-center mt-3 text-xs text-white/80 font-medium flex items-center gap-2">
              <span className="font-bold text-white">{COVER_THEMES_CATALOG.find(t => t.id === currentTheme)?.name}</span>
              <span>•</span>
              <span>High-Resolution Preview</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
