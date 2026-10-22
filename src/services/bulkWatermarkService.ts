import JSZip from 'jszip';
import { WatermarkItem, WatermarkSettings } from '../types/watermark';

/**
 * Loads an image from URL or dataURL into an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${err}`));
    img.src = src;
  });
}

/**
 * Built-in Sample Watermark PNG Badges (rendered as high-res SVGs with transparency)
 */
export const SAMPLE_WATERMARKS: Array<{ id: string; name: string; previewColor: string; dataUrl: string }> = [
  {
    id: 'badge-verified',
    name: 'Verified Creator Stamp',
    previewColor: '#E60023',
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120">
        <rect x="6" y="6" width="388" height="108" rx="28" fill="rgba(15, 23, 42, 0.75)" stroke="#ffffff" stroke-width="3" stroke-opacity="0.9"/>
        <g transform="translate(24, 26)">
          <circle cx="34" cy="34" r="32" fill="#E60023"/>
          <path d="M22 34l8 8 16-16" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <text x="108" y="52" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="900" letter-spacing="1">VERIFIED CREATOR</text>
        <text x="108" y="80" fill="#cbd5e1" font-family="sans-serif" font-size="16" font-weight="600" letter-spacing="0.5">PINPULSE ORIGINAL • 2026</text>
      </svg>
    `)}`,
  },
  {
    id: 'badge-copyright',
    name: 'Minimalist Copyright Seal',
    previewColor: '#ffffff',
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="360" height="80" viewBox="0 0 360 80">
        <rect x="4" y="4" width="352" height="72" rx="20" fill="rgba(0, 0, 0, 0.6)" stroke="rgba(255, 255, 255, 0.4)" stroke-width="2"/>
        <circle cx="40" cy="40" r="18" fill="none" stroke="#ffffff" stroke-width="3"/>
        <text x="40" y="46" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="bold">C</text>
        <text x="76" y="46" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="bold" letter-spacing="1">MYBRAND DESIGN ©</text>
      </svg>
    `)}`,
  },
  {
    id: 'badge-shield',
    name: 'Protected Artwork Seal',
    previewColor: '#38bdf8',
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="380" height="110" viewBox="0 0 380 110">
        <rect x="4" y="4" width="372" height="102" rx="24" fill="rgba(10, 15, 30, 0.8)" stroke="#38bdf8" stroke-width="2.5"/>
        <g transform="translate(24, 22)">
          <path d="M30 4 L56 16 V38 C56 56 44 70 30 76 C16 70 4 56 4 38 V16 Z" fill="#0284c7" stroke="#ffffff" stroke-width="2.5"/>
          <path d="M20 38 L28 46 L42 28" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <text x="96" y="48" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="800">PROTECTED ARTWORK</text>
        <text x="96" y="76" fill="#93c5fd" font-family="monospace" font-size="15" font-weight="700">DO NOT COPY OR REPOST</text>
      </svg>
    `)}`,
  },
  {
    id: 'badge-pinterest',
    name: 'PinPulse Brand Stamp',
    previewColor: '#E60023',
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80">
        <rect x="3" y="3" width="314" height="74" rx="37" fill="#E60023" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="40" cy="40" r="22" fill="#ffffff"/>
        <text x="40" y="49" text-anchor="middle" fill="#E60023" font-family="sans-serif" font-size="24" font-weight="900">P</text>
        <text x="80" y="46" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="900" letter-spacing="1.5">PINPULSE.PRO</text>
      </svg>
    `)}`,
  },
];

export interface RenderResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Renders the watermark onto a canvas with full transformation, opacity, rotation, and blend mode.
 */
export async function applyWatermark(
  sourceImage: HTMLImageElement,
  settings: WatermarkSettings,
  watermarkImage?: HTMLImageElement | null
): Promise<RenderResult> {
  const canvas = document.createElement('canvas');
  const width = sourceImage.naturalWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.height;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D canvas context');

  // 1. Draw source base image
  ctx.drawImage(sourceImage, 0, 0, width, height);

  // 2. Prepare watermark content
  let wmCanvas: HTMLCanvasElement;
  let wmWidth: number;
  let wmHeight: number;

  const targetWidth = Math.max(40, Math.round(width * (settings.scalePercent / 100)));

  if (settings.sourceType === 'image' && watermarkImage) {
    const naturalW = watermarkImage.naturalWidth || watermarkImage.width;
    const naturalH = watermarkImage.naturalHeight || watermarkImage.height;
    const scale = targetWidth / naturalW;
    wmWidth = Math.round(naturalW * scale);
    wmHeight = Math.max(1, Math.round(naturalH * scale));

    wmCanvas = document.createElement('canvas');
    wmCanvas.width = wmWidth;
    wmCanvas.height = wmHeight;
    const wmCtx = wmCanvas.getContext('2d');
    if (!wmCtx) throw new Error('Could not create watermark sub-canvas');

    // Optional background pill behind image
    if (settings.useBgPill) {
      wmCtx.fillStyle = settings.bgPillColor;
      wmCtx.beginPath();
      wmCtx.roundRect(0, 0, wmWidth, wmHeight, settings.bgPillRadius);
      wmCtx.fill();
    }

    wmCtx.drawImage(watermarkImage, 0, 0, wmWidth, wmHeight);
  } else {
    // Text watermark mode
    const text = settings.text.trim() || '© PinPulse';
    const fontSize = Math.max(16, Math.round(width * (settings.scalePercent / 100) * 0.22));

    const fontStyle = `${settings.isItalic ? 'italic ' : ''}${settings.isBold ? 'bold ' : ''}${fontSize}px ${settings.fontFamily}`;
    
    // Measurement canvas
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) throw new Error('Could not create measurement canvas');
    measureCtx.font = fontStyle;
    const metrics = measureCtx.measureText(text);

    const padX = settings.useBgPill ? Math.round(fontSize * 0.8) : 12;
    const padY = settings.useBgPill ? Math.round(fontSize * 0.5) : 8;
    wmWidth = Math.ceil(metrics.width + padX * 2);
    wmHeight = Math.ceil(fontSize * 1.4 + padY * 2);

    wmCanvas = document.createElement('canvas');
    wmCanvas.width = wmWidth;
    wmCanvas.height = wmHeight;
    const wmCtx = wmCanvas.getContext('2d');
    if (!wmCtx) throw new Error('Could not create text watermark sub-canvas');

    // Background pill if requested
    if (settings.useBgPill) {
      wmCtx.fillStyle = settings.bgPillColor;
      wmCtx.beginPath();
      wmCtx.roundRect(0, 0, wmWidth, wmHeight, settings.bgPillRadius);
      wmCtx.fill();
    }

    wmCtx.font = fontStyle;
    wmCtx.textBaseline = 'middle';
    wmCtx.fillStyle = settings.textColor;

    if (settings.useShadow) {
      wmCtx.shadowColor = settings.shadowColor;
      wmCtx.shadowBlur = Math.max(4, Math.round(fontSize * 0.2));
      wmCtx.shadowOffsetX = Math.max(1, Math.round(fontSize * 0.08));
      wmCtx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.08));
    }

    wmCtx.fillText(text, padX, wmHeight / 2);
  }

  // 3. Composite Watermark onto Main Canvas
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, settings.opacity));
  
  // Set blend mode
  const blendModeMap: Record<string, GlobalCompositeOperation> = {
    normal: 'source-over',
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    'soft-light': 'soft-light',
    'hard-light': 'hard-light',
  };
  ctx.globalCompositeOperation = blendModeMap[settings.blendMode] || 'source-over';

  const marginX = Math.round(width * (settings.paddingPercent / 100));
  const marginY = Math.round(height * (settings.paddingPercent / 100));

  if (settings.position === 'tiled') {
    // TILED / FULL CANVAS REPEATED PATTERN
    const diagonal = Math.hypot(width, height);
    const spacingX = Math.max(wmWidth * 1.3, width * (settings.tileSpacingPercent / 100));
    const spacingY = Math.max(wmHeight * 1.4, height * (settings.tileSpacingPercent / 100));
    const angleRad = (settings.tileAngle * Math.PI) / 180;

    ctx.translate(width / 2, height / 2);
    ctx.rotate(angleRad);

    const startX = -diagonal;
    const endX = diagonal;
    const startY = -diagonal;
    const endY = diagonal;

    let rowIndex = 0;
    for (let y = startY; y < endY; y += spacingY) {
      // Stagger alternate rows for organic distribution
      const xOffset = (rowIndex % 2 === 0) ? 0 : spacingX / 2;
      for (let x = startX + xOffset; x < endX; x += spacingX) {
        ctx.drawImage(wmCanvas, x - wmWidth / 2, y - wmHeight / 2);
      }
      rowIndex++;
    }
  } else {
    // 9-POINT ANCHOR GRID
    let posX = marginX;
    let posY = marginY;

    switch (settings.position) {
      case 'top-left':
        posX = marginX;
        posY = marginY;
        break;
      case 'top-center':
        posX = (width - wmWidth) / 2;
        posY = marginY;
        break;
      case 'top-right':
        posX = width - marginX - wmWidth;
        posY = marginY;
        break;
      case 'center-left':
        posX = marginX;
        posY = (height - wmHeight) / 2;
        break;
      case 'center':
        posX = (width - wmWidth) / 2;
        posY = (height - wmHeight) / 2;
        break;
      case 'center-right':
        posX = width - marginX - wmWidth;
        posY = (height - wmHeight) / 2;
        break;
      case 'bottom-left':
        posX = marginX;
        posY = height - marginY - wmHeight;
        break;
      case 'bottom-center':
        posX = (width - wmWidth) / 2;
        posY = height - marginY - wmHeight;
        break;
      case 'bottom-right':
      default:
        posX = width - marginX - wmWidth;
        posY = height - marginY - wmHeight;
        break;
    }

    // Apply rotation around the center of the watermark
    const centerX = posX + wmWidth / 2;
    const centerY = posY + wmHeight / 2;

    ctx.translate(centerX, centerY);
    if (settings.rotation !== 0) {
      ctx.rotate((settings.rotation * Math.PI) / 180);
    }
    ctx.drawImage(wmCanvas, -wmWidth / 2, -wmHeight / 2);
  }

  ctx.restore();

  // 4. Output as requested format (PNG, JPEG, WebP)
  const mimeType = settings.outputFormat === 'png' 
    ? 'image/png' 
    : settings.outputFormat === 'webp' 
    ? 'image/webp' 
    : 'image/jpeg';

  const quality = settings.outputQuality;

  const dataUrl = canvas.toDataURL(mimeType, quality);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate image Blob from canvas'));
      },
      mimeType,
      quality
    );
  });

  return {
    dataUrl,
    blob,
    width,
    height,
  };
}

/**
 * Batch processes an array of images with progress callbacks
 */
export async function processWatermarkBatch(
  items: WatermarkItem[],
  settings: WatermarkSettings,
  onItemProgress: (itemId: string, status: WatermarkItem['status'], result?: RenderResult, error?: string) => void
): Promise<WatermarkItem[]> {
  // Preload watermark image if in image mode
  let watermarkImg: HTMLImageElement | null = null;
  if (settings.sourceType === 'image' && settings.watermarkDataUrl) {
    try {
      watermarkImg = await loadImage(settings.watermarkDataUrl);
    } catch (err: any) {
      console.warn('Failed to preload watermark image:', err);
    }
  }

  const results: WatermarkItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onItemProgress(item.id, 'processing');

    try {
      const sourceImg = await loadImage(item.originalUrl);
      const res = await applyWatermark(sourceImg, settings, watermarkImg);

      onItemProgress(item.id, 'completed', res);
      results.push({
        ...item,
        status: 'completed',
        watermarkedUrl: res.dataUrl,
        watermarkedBlob: res.blob,
        watermarkedSizeBytes: res.blob.size,
      });
    } catch (err: any) {
      const msg = err?.message || 'Processing failed';
      onItemProgress(item.id, 'error', undefined, msg);
      results.push({
        ...item,
        status: 'error',
        error: msg,
      });
    }
  }

  return results;
}

/**
 * Packages all completed watermarked images into a single ZIP file for 1-click download.
 */
export async function packageWatermarkedZip(
  items: WatermarkItem[],
  zipFilename: string = 'Watermarked_PNGs.zip',
  suffix: string = '_watermarked',
  format: string = 'png',
  onProgress?: (percent: number, filename: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  const completed = items.filter((i) => i.status === 'completed' && i.watermarkedBlob);

  if (completed.length === 0) {
    throw new Error('No completed watermarked images ready for download.');
  }

  const usedNames = new Set<string>();

  for (let i = 0; i < completed.length; i++) {
    const item = completed[i];
    const blob = item.watermarkedBlob!;

    // Sanitize base name
    const rawName = item.name.replace(/\.[^/.]+$/, '');
    const cleanBase = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = format === 'jpeg' ? 'jpg' : format;
    let finalName = `${cleanBase}${suffix}.${ext}`;

    // Handle duplicates
    let counter = 1;
    while (usedNames.has(finalName)) {
      finalName = `${cleanBase}${suffix}_${counter}.${ext}`;
      counter++;
    }
    usedNames.add(finalName);

    zip.file(finalName, blob);

    if (onProgress) {
      const pct = Math.round(((i + 1) / completed.length) * 80);
      onProgress(pct, finalName);
    }
  }

  if (onProgress) {
    onProgress(90, 'Compressing ZIP archive...');
  }

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        const pct = 90 + Math.round(metadata.percent * 0.1);
        onProgress(pct, 'Finalizing ZIP...');
      }
    }
  );

  return zipBlob;
}

/**
 * Triggers a browser download for a given Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
