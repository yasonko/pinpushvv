import React, { useState, useRef, useEffect } from 'react';
import { 
  Stamp, 
  UploadCloud, 
  Download, 
  Layers, 
  Sparkles, 
  Trash2, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck, 
  ExternalLink, 
  Eye, 
  FolderPlus, 
  Sliders, 
  FileSpreadsheet, 
  Zap, 
  X,
  Copy,
  Check
} from 'lucide-react';
import { 
  WatermarkItem, 
  WatermarkSettings, 
  DEFAULT_WATERMARK_SETTINGS 
} from '../../types/watermark';
import { 
  processWatermarkBatch, 
  packageWatermarkedZip, 
  downloadBlob, 
  loadImage, 
  SAMPLE_WATERMARKS 
} from '../../services/bulkWatermarkService';
import { WatermarkControlsPanel } from './WatermarkControlsPanel';
import { WatermarkPreviewCanvas } from './WatermarkPreviewCanvas';
import { Pin, Board, Website } from '../../types';
import { formatBytes } from '../../services/ebook/excelGenerator';

interface BulkWatermarkViewProps {
  pins?: Pin[];
  boards?: Board[];
  websites?: Website[];
  onPinsCreated?: (newPins: Pin[]) => void;
  defaultBoardId?: string;
  defaultWebsiteId?: string;
  className?: string;
}

export const BulkWatermarkView: React.FC<BulkWatermarkViewProps> = ({
  pins = [],
  boards = [],
  websites = [],
  onPinsCreated,
  defaultBoardId,
  defaultWebsiteId,
  className = '',
}) => {
  const [items, setItems] = useState<WatermarkItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [settings, setSettings] = useState<WatermarkSettings>(() => ({
    ...DEFAULT_WATERMARK_SETTINGS,
    // Default to the first high-res sample watermark stamp
    watermarkDataUrl: SAMPLE_WATERMARKS[0].dataUrl,
    watermarkFilename: `${SAMPLE_WATERMARKS[0].name}.png`,
  }));

  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [inspectItem, setInspectItem] = useState<WatermarkItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set initial selected item when items list updates
  useEffect(() => {
    if (items.length > 0 && !items.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  // Handle incoming files
  const handleAddFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const newItems: WatermarkItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/') && !/\.(png|jpg|jpeg|webp|svg)$/i.test(file.name)) {
        continue;
      }

      const id = `wm_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`;
      const originalUrl = URL.createObjectURL(file);

      try {
        const img = await loadImage(originalUrl);
        newItems.push({
          id,
          name: file.name,
          file,
          originalUrl,
          originalWidth: img.naturalWidth || img.width,
          originalHeight: img.naturalHeight || img.height,
          originalSizeBytes: file.size,
          originalFormat: file.type.replace('image/', '') || 'png',
          status: 'idle',
        });
      } catch (err) {
        console.warn('Could not read image dimensions:', file.name, err);
        newItems.push({
          id,
          name: file.name,
          file,
          originalUrl,
          originalWidth: 1000,
          originalHeight: 1500,
          originalSizeBytes: file.size,
          originalFormat: 'png',
          status: 'idle',
        });
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      if (!selectedItemId) {
        setSelectedItemId(newItems[0].id);
      }
      setNotification(`Added ${newItems.length} image${newItems.length !== 1 ? 's' : ''}`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Load sample test canvases
  const handleLoadSamples = async () => {
    const samples = [
      {
        name: 'minimal_architecture_pin.png',
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80',
        width: 1000,
        height: 1500,
      },
      {
        name: 'botanical_interior_aesthetic.png',
        url: 'https://images.unsplash.com/photo-1545239351-ef35f43d514b?w=1000&auto=format&fit=crop&q=80',
        width: 1000,
        height: 1500,
      },
      {
        name: 'ceramic_coffee_lifestyle.png',
        url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1000&auto=format&fit=crop&q=80',
        width: 1000,
        height: 1500,
      },
      {
        name: 'modern_poster_graphics.png',
        url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1000&auto=format&fit=crop&q=80',
        width: 1000,
        height: 1500,
      },
    ];

    const newItems: WatermarkItem[] = samples.map((s, idx) => ({
      id: `sample_wm_${Date.now()}_${idx}`,
      name: s.name,
      originalUrl: s.url,
      originalWidth: s.width,
      originalHeight: s.height,
      originalSizeBytes: 420000 + idx * 85000,
      originalFormat: 'png',
      status: 'idle',
    }));

    setItems((prev) => [...prev, ...newItems]);
    setSelectedItemId(newItems[0].id);
    setNotification('Loaded 4 high-res sample images for testing');
    setTimeout(() => setNotification(null), 3000);
  };

  // Import pins from existing PinPulse library
  const handleImportPins = (selectedPins: Pin[]) => {
    const newItems: WatermarkItem[] = selectedPins.map((p, idx) => ({
      id: `pin_wm_${Date.now()}_${idx}`,
      name: p.filename || `${p.title.slice(0, 20)}.png`,
      originalUrl: p.imageUrl,
      originalWidth: 1000,
      originalHeight: 1500,
      originalSizeBytes: 350000,
      originalFormat: 'png',
      status: 'idle',
    }));

    setItems((prev) => [...prev, ...newItems]);
    if (newItems.length > 0) {
      setSelectedItemId(newItems[0].id);
    }
    setShowImportModal(false);
    setNotification(`Imported ${newItems.length} pin${newItems.length !== 1 ? 's' : ''} from library`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Start batch processing
  const handleProcessAll = async () => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress({ current: 0, total: items.length });

    try {
      let doneCount = 0;

      await processWatermarkBatch(items, settings, (itemId, status, result, err) => {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== itemId) return item;
            if (status === 'completed' && result) {
              return {
                ...item,
                status: 'completed',
                watermarkedUrl: result.dataUrl,
                watermarkedBlob: result.blob,
                watermarkedSizeBytes: result.blob.size,
                error: undefined,
              };
            }
            if (status === 'error') {
              return {
                ...item,
                status: 'error',
                error: err || 'Processing error',
              };
            }
            return { ...item, status };
          })
        );

        if (status === 'completed' || status === 'error') {
          doneCount++;
          setProgress({ current: doneCount, total: items.length });
        }
      });

      setNotification(`Processed ${items.length} images successfully!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error('Batch watermarking error:', err);
      alert(`Batch processing error: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  // Download all as ZIP
  const handleDownloadZip = async () => {
    const completed = items.filter((i) => i.status === 'completed' && i.watermarkedBlob);
    if (completed.length === 0) {
      alert('Please click "Watermark All Images" first to process the batch before downloading.');
      return;
    }

    setIsZipping(true);
    try {
      const zipBlob = await packageWatermarkedZip(
        items,
        'Watermarked_PNGs.zip',
        settings.filenameSuffix,
        settings.outputFormat
      );
      downloadBlob(zipBlob, `Watermarked_PNGs_${Date.now()}.zip`);
      setNotification(`Downloaded ZIP containing ${completed.length} watermarked images!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      console.error('ZIP generation failed:', err);
      alert(`Failed to create ZIP: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsZipping(false);
    }
  };

  // Single item download
  const handleDownloadSingle = (item: WatermarkItem) => {
    if (item.watermarkedBlob) {
      const ext = settings.outputFormat === 'jpeg' ? 'jpg' : settings.outputFormat;
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      downloadBlob(item.watermarkedBlob, `${baseName}${settings.filenameSuffix}.${ext}`);
    } else if (item.watermarkedUrl) {
      const a = document.createElement('a');
      a.href = item.watermarkedUrl;
      a.download = `${item.name.replace(/\.[^/.]+$/, '')}${settings.filenameSuffix}.png`;
      a.click();
    }
  };

  // Send to PinPulse Pin Library (Create Pins)
  const handleSendToPinLibrary = () => {
    const completed = items.filter((i) => i.status === 'completed' && i.watermarkedUrl);
    if (completed.length === 0) {
      alert('No processed watermarked images available. Process images first.');
      return;
    }

    if (!onPinsCreated) {
      alert('Pin creation handler not connected.');
      return;
    }

    const newPins: Pin[] = completed.map((item, idx) => {
      const cleanTitle = item.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        id: `pin_wm_created_${Date.now()}_${idx}`,
        filename: `${item.name.replace(/\.[^/.]+$/, '')}${settings.filenameSuffix}.png`,
        imageUrl: item.watermarkedUrl!,
        thumbnailUrl: item.watermarkedUrl!,
        title: cleanTitle,
        description: `High quality watermarked Pinterest pin created with PinPulse Bulk Watermark Studio.`,
        tags: ['Watermarked', 'Original Design', 'Pinterest'],
        targetUrl: websites[0]?.url || 'https://pinterest.com',
        boardId: defaultBoardId || boards[0]?.id || '',
        websiteId: defaultWebsiteId || websites[0]?.id || '',
        status: 'draft',
        createdAt: new Date().toISOString(),
      };
    });

    onPinsCreated(newPins);
    setNotification(`Successfully created and added ${newPins.length} pins to Pin Library!`);
    setTimeout(() => setNotification(null), 4000);
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedItemId === id) {
      const remaining = items.filter((i) => i.id !== id);
      setSelectedItemId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Clear all items
  const handleClearAll = () => {
    if (items.length === 0) return;
    if (confirm(`Remove all ${items.length} images from the workbench?`)) {
      setItems([]);
      setSelectedItemId(null);
    }
  };

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const totalSizeBytes = items.reduce((acc, i) => acc + (i.watermarkedSizeBytes || i.originalSizeBytes), 0);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-600/10 via-rose-500/5 to-transparent dark:from-red-950/40 dark:via-rose-950/20 p-5 rounded-3xl border border-red-200/80 dark:border-red-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#E60023] text-white text-[10px] font-black uppercase tracking-wider">
              NEW TOOL
            </span>
            <span className="text-xs font-bold text-red-600 dark:text-red-400">
              Lossless PNG Engine • 9-Anchor Grid or Tiled Pattern • ZIP Export
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Bulk Watermark PNG Studio
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
            Protect your pins, artwork, and marketing graphics in bulk. Upload custom transparent PNG logos or text watermarks, adjust position, rotation, opacity, and download as lossless PNG ZIP or convert directly to PinPulse pins.
          </p>
        </div>

        {/* Quick actions in top banner */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {items.length === 0 && (
            <button
              type="button"
              onClick={handleLoadSamples}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-black/60 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-white/[0.1] shadow-2xs cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Load Sample Images</span>
            </button>
          )}

          {pins.length > 0 && (
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-black/60 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-white/[0.1] shadow-2xs cursor-pointer transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>Import from Library ({pins.length})</span>
            </button>
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              title="Clear all images"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notification toast if active */}
      {notification && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-600">Active</span>
        </div>
      )}

      {/* Main Studio Grid: Left Preview & Images vs Right Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Canvas & Batch Upload/Thumbnails */}
        <div className="lg:col-span-7 space-y-6">
          {/* Drag & Drop Add Images Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer?.files) {
                handleAddFiles(e.dataTransfer.files);
              }
            }}
            className="border-2 border-dashed border-slate-300 dark:border-white/[0.12] hover:border-red-400 dark:hover:border-red-800 rounded-3xl p-6 text-center transition-all bg-white/60 dark:bg-black/40 cursor-pointer flex flex-col items-center justify-center gap-2 group"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
            />

            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/40 flex items-center justify-center text-[#E60023] group-hover:scale-110 transition-transform shadow-xs">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div className="space-y-0.5">
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Drop PNG / JPG images here, or <span className="text-[#E60023] hover:underline">browse</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Supports batch upload of transparent PNGs, standard pins, or photos.
              </p>
            </div>
          </div>

          {/* Interactive Preview Canvas */}
          <WatermarkPreviewCanvas
            items={items}
            selectedItemId={selectedItemId}
            onSelectItem={(id) => setSelectedItemId(id)}
            settings={settings}
          />
        </div>

        {/* Right 5 Columns: Watermark Settings & Tuning */}
        <div className="lg:col-span-5 space-y-6">
          <WatermarkControlsPanel
            settings={settings}
            onChange={(partial) => setSettings((prev) => ({ ...prev, ...partial }))}
          />
        </div>
      </div>

      {/* Bottom Sticky / Action Bar */}
      {items.length > 0 && (
        <div className="bg-white/95 dark:bg-black/80 dark:backdrop-blur-xl p-4 rounded-3xl border border-slate-200/80 dark:border-white/[0.1] flex flex-wrap items-center justify-between gap-4 shadow-xl sticky bottom-4 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/40 flex items-center justify-center text-[#E60023] shrink-0">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{items.length} Images in Batch</span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  {completedCount} Watermarked
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-mono text-slate-500">{formatBytes(totalSizeBytes)}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Ready to watermark using {settings.sourceType === 'image' ? 'PNG Stamp' : 'Custom Text'} ({settings.position === 'tiled' ? 'Tiled Pattern' : settings.position})
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Primary Action: Watermark All */}
            <button
              type="button"
              onClick={handleProcessAll}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-50 transition-all active:scale-95"
            >
              <RotateCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>
                {isProcessing
                  ? `Watermarking (${progress?.current || 0}/${progress?.total || items.length})...`
                  : `Watermark All (${items.length})`}
              </span>
            </button>

            {/* Download ZIP */}
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={completedCount === 0 || isZipping}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-extrabold shadow-xs cursor-pointer disabled:opacity-40 transition-all"
            >
              <Download className={`w-3.5 h-3.5 ${isZipping ? 'animate-bounce' : ''}`} />
              <span>{isZipping ? 'Creating ZIP...' : 'Download ZIP (.zip)'}</span>
            </button>

            {/* Convert to Pins */}
            {onPinsCreated && (
              <button
                type="button"
                onClick={handleSendToPinLibrary}
                disabled={completedCount === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs cursor-pointer disabled:opacity-40 transition-all"
                title="Create Pins in PinPulse Library with these watermarked images"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Create Pins ({completedCount})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Batch Results Grid */}
      {items.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-500" />
              <span>Batch Queue & Completed Files</span>
              <span className="text-xs font-normal text-slate-400">({items.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item, idx) => {
              const isCompleted = item.status === 'completed' && item.watermarkedUrl;
              const isProcessingItem = item.status === 'processing';
              const isFailed = item.status === 'error';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isCompleted
                      ? 'bg-white/90 dark:bg-black/60 border-slate-200/80 dark:border-white/[0.08] shadow-xs hover:border-red-300'
                      : isProcessingItem
                      ? 'bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 animate-pulse'
                      : isFailed
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                      : 'bg-white/60 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/[0.06]'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Thumbnail Image Box with Checkerboard background for PNG transparency */}
                    <div
                      className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-950 cursor-pointer group"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        if (isCompleted) setInspectItem(item);
                      }}
                    >
                      <div
                        className="absolute inset-0 opacity-15 pointer-events-none"
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)',
                          backgroundSize: '16px 16px',
                        }}
                      />

                      <img
                        src={item.watermarkedUrl || item.originalUrl}
                        alt={item.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />

                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono">
                        #{idx + 1}
                      </div>

                      {isCompleted && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                          <Check className="w-3 h-3" />
                          <span>Watermarked</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                        <Eye className="w-4 h-4" />
                        <span>Inspect</span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate" title={item.name}>
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                        <span>{item.originalWidth}×{item.originalHeight}</span>
                        <span>{formatBytes(item.watermarkedSizeBytes || item.originalSizeBytes)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className={`text-xs font-bold px-2 py-1 rounded-lg cursor-pointer ${
                        selectedItemId === item.id
                          ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-extrabold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {selectedItemId === item.id ? 'Previewing' : 'Preview'}
                    </button>

                    <div className="flex items-center gap-1">
                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                          title="Download watermarked file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Remove from list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Library Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.1] rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08]">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Import Pins from Library
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select pins to load directly into the Bulk Watermark studio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto max-h-[50vh] grid grid-cols-3 sm:grid-cols-4 gap-3">
              {pins.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleImportPins([p])}
                  className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] hover:border-red-500 cursor-pointer transition-all"
                >
                  <img
                    src={p.thumbnailUrl || p.imageUrl}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <span className="text-[10px] font-bold text-white truncate">{p.title}</span>
                    <span className="text-[9px] text-red-400 font-extrabold">+ Add to Watermark</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleImportPins(pins)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Import All ({pins.length}) Pins
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect High-Res Modal */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.1] rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-md">
                  {inspectItem.name}
                </h4>
                <div className="text-xs text-slate-500 font-mono">
                  {inspectItem.originalWidth}×{inspectItem.originalHeight} • {formatBytes(inspectItem.watermarkedSizeBytes || inspectItem.originalSizeBytes)} • {settings.outputFormat.toUpperCase()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 flex items-center justify-center overflow-auto max-h-[65vh] bg-slate-950 rounded-2xl p-4 my-2 relative">
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)',
                  backgroundSize: '20px 20px',
                }}
              />
              <img
                src={inspectItem.watermarkedUrl || inspectItem.originalUrl}
                alt={inspectItem.name}
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-2xl relative z-10"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDownloadSingle(inspectItem)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Watermarked Image</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
