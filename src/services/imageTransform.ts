/**
 * Image Transformation Engine:
 * Aspect Ratio Cropper (2:3 Pinterest standard, 9:16 Idea pins, 1:1 Square)
 * Batch Watermark & Brand Logo Stamper
 */

export interface WatermarkOptions {
  type: 'text' | 'image';
  text?: string;
  watermarkDataUrl?: string;
  position: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left' | 'center';
  opacity: number; // 0.1 to 1.0
  fontSize?: number; // default 24
  textColor?: string; // default #ffffff
  bgColor?: string; // optional background pill
  padding?: number; // distance from edge
}

export type TargetAspectRatio = '2:3' | '9:16' | '1:1' | '4:5';

/**
 * Load an image from URL or dataURL into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Applies a text or logo watermark onto an image canvas
 */
export async function applyWatermarkToImage(
  sourceImageUrl: string,
  options: WatermarkOptions
): Promise<string> {
  const img = await loadImage(sourceImageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // Draw source image
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const padding = options.padding || Math.max(20, Math.round(canvas.width * 0.04));
  const opacity = Math.max(0.05, Math.min(1, options.opacity ?? 0.85));

  ctx.save();
  ctx.globalAlpha = opacity;

  if (options.type === 'text' && options.text?.trim()) {
    const fontSize = options.fontSize || Math.max(18, Math.round(canvas.width * 0.032));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';

    const text = options.text.trim();
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.3;

    // Calculate position
    let x = padding;
    let y = canvas.height - padding - textHeight / 2;

    if (options.position === 'bottom-right') {
      x = canvas.width - padding - textWidth;
      y = canvas.height - padding - textHeight / 2;
    } else if (options.position === 'bottom-center') {
      x = (canvas.width - textWidth) / 2;
      y = canvas.height - padding - textHeight / 2;
    } else if (options.position === 'top-right') {
      x = canvas.width - padding - textWidth;
      y = padding + textHeight / 2;
    } else if (options.position === 'top-left') {
      x = padding;
      y = padding + textHeight / 2;
    } else if (options.position === 'center') {
      x = (canvas.width - textWidth) / 2;
      y = canvas.height / 2;
    }

    // Optional background pill for contrast
    if (options.bgColor) {
      ctx.fillStyle = options.bgColor;
      ctx.beginPath();
      ctx.roundRect(x - 12, y - textHeight / 2 - 4, textWidth + 24, textHeight + 8, 8);
      ctx.fill();
    }

    // Draw text with soft shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = options.textColor || '#ffffff';
    ctx.fillText(text, x, y);
  } else if (options.type === 'image' && options.watermarkDataUrl) {
    const watermarkImg = await loadImage(options.watermarkDataUrl);
    const maxWatermarkWidth = canvas.width * 0.28;
    const scale = maxWatermarkWidth / (watermarkImg.naturalWidth || watermarkImg.width);
    const wmWidth = (watermarkImg.naturalWidth || watermarkImg.width) * scale;
    const wmHeight = (watermarkImg.naturalHeight || watermarkImg.height) * scale;

    let x = padding;
    let y = canvas.height - padding - wmHeight;

    if (options.position === 'bottom-right') {
      x = canvas.width - padding - wmWidth;
      y = canvas.height - padding - wmHeight;
    } else if (options.position === 'bottom-center') {
      x = (canvas.width - wmWidth) / 2;
      y = canvas.height - padding - wmHeight;
    } else if (options.position === 'top-right') {
      x = canvas.width - padding - wmWidth;
      y = padding;
    } else if (options.position === 'top-left') {
      x = padding;
      y = padding;
    } else if (options.position === 'center') {
      x = (canvas.width - wmWidth) / 2;
      y = (canvas.height - wmHeight) / 2;
    }

    ctx.drawImage(watermarkImg, x, y, wmWidth, wmHeight);
  }

  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Resizes / crops image to exact Pinterest target aspect ratio (e.g. 2:3 standard 1000x1500)
 */
export async function convertAspectRatio(
  sourceImageUrl: string,
  targetRatio: TargetAspectRatio,
  mode: 'crop' | 'pad' = 'crop',
  padBgColor: string = '#ffffff'
): Promise<string> {
  const img = await loadImage(sourceImageUrl);
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;

  let ratioValue = 2 / 3; // default Pinterest
  let targetWidth = 1000;
  let targetHeight = 1500;

  if (targetRatio === '2:3') {
    ratioValue = 2 / 3;
    targetWidth = 1000;
    targetHeight = 1500;
  } else if (targetRatio === '9:16') {
    ratioValue = 9 / 16;
    targetWidth = 1080;
    targetHeight = 1920;
  } else if (targetRatio === '1:1') {
    ratioValue = 1;
    targetWidth = 1200;
    targetHeight = 1200;
  } else if (targetRatio === '4:5') {
    ratioValue = 4 / 5;
    targetWidth = 1080;
    targetHeight = 1350;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  if (mode === 'crop') {
    // Smart center crop
    const srcRatio = srcWidth / srcHeight;
    let renderW: number;
    let renderH: number;
    let offsetX = 0;
    let offsetY = 0;

    if (srcRatio > ratioValue) {
      // Source is wider than target ratio
      renderH = srcHeight;
      renderW = srcHeight * ratioValue;
      offsetX = (srcWidth - renderW) / 2;
    } else {
      // Source is taller than target ratio
      renderW = srcWidth;
      renderH = srcWidth / ratioValue;
      offsetY = (srcHeight - renderH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH, 0, 0, targetWidth, targetHeight);
  } else {
    // Pad with background color
    ctx.fillStyle = padBgColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
    const destW = srcWidth * scale;
    const destH = srcHeight * scale;
    const destX = (targetWidth - destW) / 2;
    const destY = (targetHeight - destH) / 2;

    ctx.drawImage(img, 0, 0, srcWidth, srcHeight, destX, destY, destW, destH);
  }

  return canvas.toDataURL('image/jpeg', 0.9);
}
