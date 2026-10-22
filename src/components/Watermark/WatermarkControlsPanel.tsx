import React, { useRef } from 'react';
import { 
  Stamp, 
  Type, 
  Image as ImageIcon, 
  UploadCloud, 
  Grid, 
  Maximize2, 
  RotateCw, 
  Sliders, 
  Layers, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  FileCheck,
  Palette,
  Eye,
  Settings2
} from 'lucide-react';
import { 
  WatermarkSettings, 
  WatermarkPosition, 
  WatermarkBlendMode, 
  WatermarkOutputFormat 
} from '../../types/watermark';
import { SAMPLE_WATERMARKS } from '../../services/bulkWatermarkService';

interface WatermarkControlsPanelProps {
  settings: WatermarkSettings;
  onChange: (partial: Partial<WatermarkSettings>) => void;
  className?: string;
}

export const WatermarkControlsPanel: React.FC<WatermarkControlsPanelProps> = ({
  settings,
  onChange,
  className = '',
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onChange({
        sourceType: 'image',
        watermarkDataUrl: dataUrl,
        watermarkFilename: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSampleWatermark = (sample: typeof SAMPLE_WATERMARKS[0]) => {
    onChange({
      sourceType: 'image',
      watermarkDataUrl: sample.dataUrl,
      watermarkFilename: `${sample.name}.png`,
    });
  };

  // 9-point anchor grid cells
  const gridPositions: Array<{ id: WatermarkPosition; label: string }> = [
    { id: 'top-left', label: 'TL' },
    { id: 'top-center', label: 'TC' },
    { id: 'top-right', label: 'TR' },
    { id: 'center-left', label: 'CL' },
    { id: 'center', label: 'C' },
    { id: 'center-right', label: 'CR' },
    { id: 'bottom-left', label: 'BL' },
    { id: 'bottom-center', label: 'BC' },
    { id: 'bottom-right', label: 'BR' },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Watermark Type Switcher */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Stamp className="w-3.5 h-3.5 text-[#E60023]" />
            <span>Watermark Source</span>
          </label>

          <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => onChange({ sourceType: 'image' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                settings.sourceType === 'image'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
              <span>PNG Logo / Graphic</span>
            </button>

            <button
              type="button"
              onClick={() => onChange({ sourceType: 'text' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                settings.sourceType === 'text'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5 text-emerald-500" />
              <span>Custom Text</span>
            </button>
          </div>
        </div>

        {/* If PNG Logo mode */}
        {settings.sourceType === 'image' ? (
          <div className="space-y-3 pt-1">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/webp,image/svg+xml,image/jpeg"
              className="hidden"
              onChange={handleLogoUpload}
            />

            {/* Custom Upload Drop Box */}
            <div
              onClick={() => logoInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-white/[0.12] hover:border-red-400 dark:hover:border-red-600 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/40 flex items-center justify-center text-[#E60023] shrink-0 group-hover:scale-105 transition-transform overflow-hidden p-1">
                  {settings.watermarkDataUrl ? (
                    <img
                      src={settings.watermarkDataUrl}
                      alt="Watermark preview"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {settings.watermarkFilename || 'Upload Watermark PNG'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {settings.watermarkDataUrl
                      ? 'Click to change watermark file'
                      : 'Supports transparent PNGs, SVGs, or JPGs'}
                  </div>
                </div>
              </div>

              <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-white/[0.08] shadow-2xs shrink-0 group-hover:bg-red-50 group-hover:text-red-600 dark:group-hover:bg-red-950/40 transition-colors">
                Browse PNG
              </span>
            </div>

            {/* Presets Badges */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Or pick a ready-made PNG stamp:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_WATERMARKS.map((sample) => {
                  const isSelected = settings.watermarkDataUrl === sample.dataUrl;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSampleWatermark(sample)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 shadow-2xs'
                          : 'bg-white dark:bg-white/[0.03] border-slate-200/80 dark:border-white/[0.08] hover:border-slate-300 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                        <img
                          src={sample.dataUrl}
                          alt={sample.name}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="truncate text-[11px]">{sample.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* If Text Mode */
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Watermark Text
              </label>
              <input
                type="text"
                value={settings.text}
                onChange={(e) => onChange({ text: e.target.value })}
                placeholder="© My Brand or Website"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-xs font-bold text-slate-900 dark:text-white focus:border-red-500 outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Font Family
                </label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => onChange({ fontFamily: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
                >
                  <option value="Plus Jakarta Sans, sans-serif">Modern Sans</option>
                  <option value="Outfit, sans-serif">Outfit Display</option>
                  <option value="Georgia, serif">Classic Serif</option>
                  <option value="JetBrains Mono, monospace">Clean Monospace</option>
                  <option value="'Impact', 'Arial Black', sans-serif">Heavy Impact</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.textColor}
                    onChange={(e) => onChange({ textColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-white/[0.1] p-0.5 bg-transparent"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onChange({ isBold: !settings.isBold })}
                      className={`w-7 h-7 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                        settings.isBold
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06]'
                      }`}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ isItalic: !settings.isItalic })}
                      className={`w-7 h-7 rounded-lg text-xs font-serif italic transition-colors cursor-pointer ${
                        settings.isItalic
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06]'
                      }`}
                    >
                      I
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Position & Placement Grid */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5 text-blue-500" />
            <span>Position & Layout</span>
          </label>

          <button
            type="button"
            onClick={() =>
              onChange({
                position: settings.position === 'tiled' ? 'bottom-right' : 'tiled',
              })
            }
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              settings.position === 'tiled'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-transparent shadow-xs'
                : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:border-red-300'
            }`}
            title="Repeat watermark diagonally across whole image (protective seal)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tiled Pattern</span>
          </button>
        </div>

        {/* 9-Point Anchor Grid if not in tiled mode */}
        {settings.position !== 'tiled' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] max-w-[240px] mx-auto">
              {gridPositions.map((pos) => {
                const isSelected = settings.position === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => onChange({ position: pos.id })}
                    className={`h-11 rounded-xl flex items-center justify-center font-mono text-[11px] font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E60023] text-white shadow-xs scale-105 ring-2 ring-red-400/40'
                        : 'bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {pos.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-center text-slate-400 font-medium">
              Click any anchor point (e.g. Bottom-Right standard for Pinterest)
            </p>
          </div>
        ) : (
          /* Tiled Pattern Settings */
          <div className="p-3 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-red-900 dark:text-red-200">
                Diagonal Tiled Grid Active
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-bold">
                Anti-Theft Seal
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                <span>Tile Spacing</span>
                <span className="font-mono">{settings.tileSpacingPercent}%</span>
              </div>
              <input
                type="range"
                min={15}
                max={50}
                step={2}
                value={settings.tileSpacingPercent}
                onChange={(e) => onChange({ tileSpacingPercent: Number(e.target.value) })}
                className="w-full accent-red-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Transforms (Scale, Opacity, Rotation, Margins) */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-4 shadow-xs">
        <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-emerald-500" />
          <span>Watermark Transforms & Style</span>
        </label>

        {/* Scale Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Maximize2 className="w-3 h-3 text-slate-400" />
              <span>Size / Scale</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange({ scalePercent: 15 })}
                className="text-[10px] text-slate-400 hover:text-slate-800 dark:hover:text-white underline cursor-pointer"
              >
                15%
              </button>
              <button
                type="button"
                onClick={() => onChange({ scalePercent: 25 })}
                className="text-[10px] text-slate-400 hover:text-slate-800 dark:hover:text-white underline cursor-pointer"
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => onChange({ scalePercent: 40 })}
                className="text-[10px] text-slate-400 hover:text-slate-800 dark:hover:text-white underline cursor-pointer"
              >
                40%
              </button>
              <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] px-1.5 py-0.2 rounded text-[11px]">
                {settings.scalePercent}%
              </span>
            </div>
          </div>
          <input
            type="range"
            min={8}
            max={75}
            step={1}
            value={settings.scalePercent}
            onChange={(e) => onChange({ scalePercent: Number(e.target.value) })}
            className="w-full accent-red-600 cursor-pointer"
          />
        </div>

        {/* Opacity Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Eye className="w-3 h-3 text-slate-400" />
              <span>Opacity</span>
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] px-1.5 py-0.2 rounded text-[11px]">
              {Math.round(settings.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={settings.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
            className="w-full accent-red-600 cursor-pointer"
          />
        </div>

        {/* Rotation */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-slate-400" />
              <span>Rotation</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChange({ rotation: 0 })}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
              >
                0°
              </button>
              <button
                type="button"
                onClick={() => onChange({ rotation: -30 })}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
              >
                -30°
              </button>
              <button
                type="button"
                onClick={() => onChange({ rotation: 45 })}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
              >
                45°
              </button>
              <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] px-1.5 py-0.2 rounded text-[11px]">
                {settings.rotation}°
              </span>
            </div>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={5}
            value={settings.rotation}
            onChange={(e) => onChange({ rotation: Number(e.target.value) })}
            className="w-full accent-red-600 cursor-pointer"
          />
        </div>

        {/* Edge Padding */}
        {settings.position !== 'tiled' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Edge Margins</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-white/[0.08] px-1.5 py-0.2 rounded text-[11px]">
                {settings.paddingPercent}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={15}
              step={1}
              value={settings.paddingPercent}
              onChange={(e) => onChange({ paddingPercent: Number(e.target.value) })}
              className="w-full accent-red-600 cursor-pointer"
            />
          </div>
        )}

        {/* Blend Mode & Background Pill */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Blend Mode
            </label>
            <select
              value={settings.blendMode}
              onChange={(e) => onChange({ blendMode: e.target.value as WatermarkBlendMode })}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-xs font-semibold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="normal">Normal (Source)</option>
              <option value="multiply">Multiply (Darken)</option>
              <option value="screen">Screen (Lighten)</option>
              <option value="overlay">Overlay</option>
              <option value="soft-light">Soft Light</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Contrast Pill Badge
            </label>
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useBgPill}
                onChange={(e) => onChange({ useBgPill: e.target.checked })}
                className="w-3.5 h-3.5 text-red-600 rounded focus:ring-red-500"
              />
              <span className="text-slate-700 dark:text-slate-300">Dark Pill</span>
            </label>
          </div>
        </div>
      </div>

      {/* 4. Output Settings */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] space-y-3 shadow-xs">
        <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Output Format & File Name</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Format
            </label>
            <select
              value={settings.outputFormat}
              onChange={(e) => onChange({ outputFormat: e.target.value as WatermarkOutputFormat })}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value="png">PNG (Lossless & Alpha)</option>
              <option value="jpeg">JPEG (Compact)</option>
              <option value="webp">WebP (Modern)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Filename Suffix
            </label>
            <input
              type="text"
              value={settings.filenameSuffix}
              onChange={(e) => onChange({ filenameSuffix: e.target.value })}
              placeholder="_watermarked"
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
