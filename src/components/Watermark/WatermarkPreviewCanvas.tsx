import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, 
  EyeOff, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Image as ImageIcon, 
  Sparkles, 
  Layers, 
  Maximize2 
} from 'lucide-react';
import { WatermarkItem, WatermarkSettings } from '../../types/watermark';
import { applyWatermark, loadImage, RenderResult } from '../../services/bulkWatermarkService';
import { formatBytes } from '../../services/ebook/excelGenerator';

interface WatermarkPreviewCanvasProps {
  items: WatermarkItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  settings: WatermarkSettings;
  className?: string;
}

export const WatermarkPreviewCanvas: React.FC<WatermarkPreviewCanvasProps> = ({
  items,
  selectedItemId,
  onSelectItem,
  settings,
  className = '',
}) => {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeMeta, setActiveMeta] = useState<{ width: number; height: number; size: number } | null>(null);

  const selectedItem = items.find((i) => i.id === selectedItemId) || items[0] || null;

  // Re-render preview whenever settings or selected item change
  useEffect(() => {
    if (!selectedItem) {
      setPreviewDataUrl(null);
      setActiveMeta(null);
      return;
    }

    let isMounted = true;
    const render = async () => {
      setIsRendering(true);
      try {
        const sourceImg = await loadImage(selectedItem.originalUrl);
        let wmImg: HTMLImageElement | null = null;
        if (settings.sourceType === 'image' && settings.watermarkDataUrl) {
          wmImg = await loadImage(settings.watermarkDataUrl);
        }

        const res = await applyWatermark(sourceImg, settings, wmImg);
        if (isMounted) {
          setPreviewDataUrl(res.dataUrl);
          setActiveMeta({
            width: res.width,
            height: res.height,
            size: res.blob.size,
          });
        }
      } catch (err) {
        console.warn('Failed to render live preview:', err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    // Quick debounce
    const timer = setTimeout(render, 40);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [selectedItem?.id, selectedItem?.originalUrl, settings]);

  if (!selectedItem) {
    return (
      <div className={`p-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/[0.1] flex flex-col items-center justify-center text-center space-y-3 bg-white/40 dark:bg-black/20 ${className}`}>
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/40 flex items-center justify-center text-[#E60023]">
          <ImageIcon className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
            No Images Selected
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
            Upload or drop your PNG or JPG images on the left to see the live watermark preview instantly.
          </p>
        </div>
      </div>
    );
  }

  const currentSrc = showOriginal ? selectedItem.originalUrl : (previewDataUrl || selectedItem.originalUrl);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Bar with Info & Compare Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/80 dark:bg-black/60 dark:backdrop-blur-xl p-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[200px]">
            {selectedItem.name}
          </span>
          {activeMeta && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-lg shrink-0">
              <span>{activeMeta.width}×{activeMeta.height}</span>
              <span>•</span>
              <span>{formatBytes(activeMeta.size)}</span>
              <span>•</span>
              <span className="uppercase text-emerald-600 dark:text-emerald-400 font-bold">
                {settings.outputFormat}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Compare Before / After Toggle */}
          <button
            type="button"
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onMouseLeave={() => setShowOriginal(false)}
            onTouchStart={() => setShowOriginal(true)}
            onTouchEnd={() => setShowOriginal(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer border ${
              showOriginal
                ? 'bg-amber-500 text-white border-transparent shadow-xs'
                : 'bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-white/[0.08] hover:bg-slate-200'
            }`}
            title="Press and hold to view original image without watermark"
          >
            {showOriginal ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Showing Original</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Hold for Original</span>
              </>
            )}
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] p-0.5 rounded-xl border border-slate-200/60 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 text-slate-600 dark:text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel !== 1 && (
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                title="Reset zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-950/80 border border-slate-200/80 dark:border-white/[0.1] shadow-lg flex items-center justify-center min-h-[380px] max-h-[560px] p-4 group">
        {/* Transparent checkerboard grid background for PNG transparency visibility */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        />

        {isRendering && (
          <div className="absolute top-4 right-4 z-20 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-mono font-bold flex items-center gap-1.5 border border-white/20 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>Rendering Watermark...</span>
          </div>
        )}

        {showOriginal && (
          <div className="absolute top-4 left-4 z-20 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
            Original (Unmarked)
          </div>
        )}

        <div
          className="relative transition-transform duration-200 flex items-center justify-center max-w-full max-h-full"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <img
            src={currentSrc}
            alt={selectedItem.name}
            className="max-h-[500px] w-auto max-w-full object-contain rounded-xl shadow-2xl transition-all"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Bottom Thumbnails Carousel (Switch Preview Image) */}
      {items.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
            <span>Click to preview watermark on different images ({items.length} total):</span>
            <span className="font-mono">
              #{items.findIndex((i) => i.id === selectedItem.id) + 1} of {items.length}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 px-1 scrollbar-thin">
            {items.map((item, idx) => {
              const isSelected = item.id === selectedItem.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#E60023] ring-2 ring-red-400/40 scale-105 shadow-md'
                      : 'border-slate-200/80 dark:border-white/[0.1] hover:border-slate-400 opacity-70 hover:opacity-100'
                  }`}
                  title={item.name}
                >
                  <img
                    src={item.originalUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-mono text-center truncate px-0.5">
                    #{idx + 1}
                  </span>
                  {item.status === 'completed' && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
