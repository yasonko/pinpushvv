import { PdfSettings, EbookMetadata, EbookImageItem, CoverThemeType } from '../../types/ebook';

export interface CoverRenderOptions {
  title: string;
  subtitle?: string;
  author?: string;
  theme?: CoverThemeType;
  sampleImage?: EbookImageItem;
  width?: number; // default 1240 (A4 150 DPI)
  height?: number; // default 1754 (A4 150 DPI)
}

export interface CoverThemeMeta {
  id: CoverThemeType;
  name: string;
  category: string;
  description: string;
  previewBg: string;
  accentColor: string;
  textColor: string;
}

export const COVER_THEMES_CATALOG: CoverThemeMeta[] = [
  {
    id: 'none',
    name: 'None (No Cover)',
    category: 'Standard',
    description: 'Start document directly on Page 1 without any cover page',
    previewBg: 'bg-slate-100 dark:bg-zinc-800 border-dashed',
    accentColor: '#94A3B8',
    textColor: '#64748B',
  },
  {
    id: 'modern',
    name: 'Modern Tech & Studio',
    category: 'Digital / Tech',
    description: 'Obsidian slate with electric cyan neon accents and digital grid',
    previewBg: 'bg-gradient-to-br from-[#0B0F19] to-[#1E293B]',
    accentColor: '#06B6D4',
    textColor: '#FFFFFF',
  },
  {
    id: 'minimal',
    name: 'Scandinavian Minimalist',
    category: 'Gallery / Art',
    description: 'Clean alabaster canvas, stark editorial serif & gallery matting',
    previewBg: 'bg-gradient-to-br from-[#FAFAF9] to-[#E7E5E4]',
    accentColor: '#18181B',
    textColor: '#18181B',
  },
  {
    id: 'elegant',
    name: 'Luxury Royale & Gold',
    category: 'Premium / Book',
    description: 'Onyx velvet background with champagne gold filigree & Roman serif',
    previewBg: 'bg-gradient-to-br from-[#09090B] to-[#1C1917]',
    accentColor: '#D4AF37',
    textColor: '#FDFBF7',
  },
  {
    id: 'magazine',
    name: 'Lifestyle Editorial',
    category: 'Fashion / Magazine',
    description: 'High-fashion editorial layout, masthead headline & issue barcode',
    previewBg: 'bg-gradient-to-br from-[#111827] to-[#1F2937]',
    accentColor: '#F43F5E',
    textColor: '#FFFFFF',
  },
  {
    id: 'nature',
    name: 'Botanical Earth & Sage',
    category: 'Organic / Green',
    description: 'Deep rainforest emerald with sage accents & organic styling',
    previewBg: 'bg-gradient-to-br from-[#022C22] to-[#064E3B]',
    accentColor: '#34D399',
    textColor: '#F0FDF4',
  },
  {
    id: 'vintage',
    name: 'Classic Heritage Parchment',
    category: 'Archival / Classic',
    description: 'Warm antique parchment, ornamental borders & Victorian typography',
    previewBg: 'bg-gradient-to-br from-[#2D1B0F] to-[#170E08]',
    accentColor: '#C5A059',
    textColor: '#F5EBE1',
  },
  {
    id: 'playful',
    name: 'Vibrant Creative & Amber',
    category: 'Activity / Kids',
    description: 'Warm golden sunbeam gradient, playful badges & cheerful styling',
    previewBg: 'bg-gradient-to-br from-[#FFFBEB] to-[#FDE68A]',
    accentColor: '#F59E0B',
    textColor: '#78350F',
  },
  {
    id: 'gradient',
    name: 'Twilight Aurora & Violet',
    category: 'Contemporary',
    description: 'Deep ultraviolet nebula glow with frosted glassmorphism accents',
    previewBg: 'bg-gradient-to-br from-[#1E1035] to-[#3B0764]',
    accentColor: '#EC4899',
    textColor: '#FFFFFF',
  },
  {
    id: 'dark',
    name: 'Cyber Noir & Crimson',
    category: 'Editorial / Impact',
    description: 'High-contrast pitch dark with vivid ruby crimson coordinates',
    previewBg: 'bg-gradient-to-br from-[#050507] to-[#18181B]',
    accentColor: '#E11D48',
    textColor: '#FFFFFF',
  },
];

/**
 * Renders a high-resolution, visually balanced eBook Cover using HTML5 Canvas.
 * Returns a high-quality JPEG / PNG Data URL.
 */
export async function generateEbookCoverCanvas(
  options: CoverRenderOptions
): Promise<string> {
  if (options.theme === 'none') {
    return '';
  }

  const width = options.width || 1240;
  const height = options.height || 1754;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context not supported');
  }

  const theme: CoverThemeType = options.theme || 'modern';

  // Comprehensive design tokens per theme
  const palettes: Record<string, any> = {
    modern: {
      bgGradStart: '#0B0F19',
      bgGradEnd: '#1E293B',
      accent: '#06B6D4',
      accentAlt: '#3B82F6',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      badgeBg: 'rgba(6, 182, 212, 0.16)',
      badgeText: '#38BDF8',
      border: 'rgba(255, 255, 255, 0.12)',
      titleFont: 'bold 58px Outfit, -apple-system, sans-serif',
      serifTitle: false,
      badgeLabel: 'DIGITAL COLLECTOR EDITION • 2026',
      showBarcode: true,
      cardBg: 'rgba(15, 23, 42, 0.75)',
    },
    minimal: {
      bgGradStart: '#FAFAF9',
      bgGradEnd: '#E7E5E4',
      accent: '#18181B',
      accentAlt: '#71717A',
      textPrimary: '#18181B',
      textSecondary: '#52525B',
      badgeBg: 'rgba(24, 24, 27, 0.07)',
      badgeText: '#18181B',
      border: 'rgba(24, 24, 27, 0.18)',
      titleFont: 'bold 60px Georgia, "Times New Roman", serif',
      serifTitle: true,
      badgeLabel: 'CURATED PORTFOLIO № 01',
      showBarcode: false,
      cardBg: '#FFFFFF',
    },
    elegant: {
      bgGradStart: '#09090B',
      bgGradEnd: '#1C1917',
      accent: '#D4AF37', // Champagne Gold
      accentAlt: '#F59E0B',
      textPrimary: '#FDFBF7',
      textSecondary: '#D6D3D1',
      badgeBg: 'rgba(212, 175, 55, 0.18)',
      badgeText: '#F3E5AB',
      border: 'rgba(212, 175, 55, 0.35)',
      titleFont: 'bold 56px Georgia, "Times New Roman", serif',
      serifTitle: true,
      badgeLabel: 'EXECUTIVE ROYAL EDITION • ARCHIVAL',
      showBarcode: false,
      cardBg: 'rgba(28, 25, 23, 0.85)',
    },
    magazine: {
      bgGradStart: '#111827',
      bgGradEnd: '#1F2937',
      accent: '#F43F5E',
      accentAlt: '#FB7185',
      textPrimary: '#FFFFFF',
      textSecondary: '#E5E7EB',
      badgeBg: 'rgba(244, 63, 94, 0.2)',
      badgeText: '#FB7185',
      border: 'rgba(255, 255, 255, 0.15)',
      titleFont: '900 68px Outfit, -apple-system, sans-serif',
      serifTitle: false,
      badgeLabel: 'VOL. 04 • DIGITAL EXCLUSIVE PUBLICATION',
      showBarcode: true,
      cardBg: 'rgba(17, 24, 39, 0.8)',
    },
    nature: {
      bgGradStart: '#022C22',
      bgGradEnd: '#064E3B',
      accent: '#34D399',
      accentAlt: '#A7F3D0',
      textPrimary: '#F0FDF4',
      textSecondary: '#D1FAE5',
      badgeBg: 'rgba(52, 211, 153, 0.18)',
      badgeText: '#6EE7B7',
      border: 'rgba(52, 211, 153, 0.28)',
      titleFont: 'bold 58px Outfit, Georgia, serif',
      serifTitle: true,
      badgeLabel: 'BOTANICAL & NATURAL ARCHIVE',
      showBarcode: false,
      cardBg: 'rgba(2, 44, 34, 0.85)',
    },
    vintage: {
      bgGradStart: '#2D1B0F',
      bgGradEnd: '#170E08',
      accent: '#C5A059',
      accentAlt: '#E0C080',
      textPrimary: '#F5EBE1',
      textSecondary: '#D4C3B3',
      badgeBg: 'rgba(197, 160, 89, 0.2)',
      badgeText: '#E6CF9D',
      border: 'rgba(197, 160, 89, 0.35)',
      titleFont: 'bold 56px Georgia, "Times New Roman", serif',
      serifTitle: true,
      badgeLabel: 'EST. 2026 • HERITAGE ARCHIVAL PRINT',
      showBarcode: false,
      cardBg: 'rgba(38, 22, 12, 0.9)',
    },
    playful: {
      bgGradStart: '#FFFBEB',
      bgGradEnd: '#FDE68A',
      accent: '#F59E0B',
      accentAlt: '#EA580C',
      textPrimary: '#78350F',
      textSecondary: '#92400E',
      badgeBg: 'rgba(245, 158, 11, 0.22)',
      badgeText: '#B45309',
      border: 'rgba(245, 158, 11, 0.35)',
      titleFont: '800 60px Outfit, -apple-system, sans-serif',
      serifTitle: false,
      badgeLabel: '★ SPECIAL CREATIVE EDITION ★',
      showBarcode: false,
      cardBg: '#FFFFFF',
    },
    gradient: {
      bgGradStart: '#1E1035',
      bgGradEnd: '#3B0764',
      accent: '#EC4899',
      accentAlt: '#A855F7',
      textPrimary: '#FFFFFF',
      textSecondary: '#F3E8FF',
      badgeBg: 'rgba(236, 72, 153, 0.22)',
      badgeText: '#F472B6',
      border: 'rgba(255, 255, 255, 0.18)',
      titleFont: 'bold 60px Outfit, -apple-system, sans-serif',
      serifTitle: false,
      badgeLabel: 'NEXT-GEN DIGITAL SERIES • 2026',
      showBarcode: true,
      cardBg: 'rgba(46, 16, 101, 0.7)',
    },
    dark: {
      bgGradStart: '#050507',
      bgGradEnd: '#18181B',
      accent: '#E11D48',
      accentAlt: '#FB7185',
      textPrimary: '#FFFFFF',
      textSecondary: '#A1A1AA',
      badgeBg: 'rgba(225, 29, 72, 0.2)',
      badgeText: '#FB7185',
      border: 'rgba(255, 255, 255, 0.12)',
      titleFont: '900 62px "JetBrains Mono", Outfit, sans-serif',
      serifTitle: false,
      badgeLabel: 'REF: #001 // SECURE DIGITAL PUBLICATION',
      showBarcode: true,
      cardBg: 'rgba(10, 10, 12, 0.85)',
    },
  };

  const p = palettes[theme] || palettes.modern;

  // 1. Draw Background Gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, p.bgGradStart);
  grad.addColorStop(1, p.bgGradEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 1b. Subtle background textures / decorations
  if (theme === 'modern' || theme === 'dark') {
    // Subtle dot grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    const spacing = 40;
    for (let x = 40; x < width; x += spacing) {
      for (let y = 40; y < height; y += spacing) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  } else if (theme === 'gradient') {
    // Soft glowing radial orbs
    const rad1 = ctx.createRadialGradient(width * 0.8, height * 0.2, 50, width * 0.8, height * 0.2, 450);
    rad1.addColorStop(0, 'rgba(236, 72, 153, 0.25)');
    rad1.addColorStop(1, 'rgba(236, 72, 153, 0)');
    ctx.fillStyle = rad1;
    ctx.fillRect(0, 0, width, height);
  } else if (theme === 'elegant') {
    // Luxury subtle sunburst or vignette
    const radG = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width * 0.8);
    radG.addColorStop(0, 'rgba(212, 175, 55, 0.08)');
    radG.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radG;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Draw Decorative Borders / Frames
  const margin = 48;
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  if (theme === 'elegant' || theme === 'vintage') {
    // Ornate double border
    const innerMargin = margin + 12;
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(innerMargin, innerMargin, width - innerMargin * 2, height - innerMargin * 2);

    // Corner diamond ornaments
    drawDiamond(ctx, margin, margin, 10, p.accent);
    drawDiamond(ctx, width - margin, margin, 10, p.accent);
    drawDiamond(ctx, margin, height - margin, 10, p.accent);
    drawDiamond(ctx, width - margin, height - margin, 10, p.accent);
  } else if (theme === 'modern' || theme === 'dark') {
    // Modern geometric bracket corners
    const cSize = 28;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    // Top-Left
    ctx.beginPath();
    ctx.moveTo(margin - 4, margin + cSize);
    ctx.lineTo(margin - 4, margin - 4);
    ctx.lineTo(margin + cSize, margin - 4);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.moveTo(width - margin + 4 - cSize, margin - 4);
    ctx.lineTo(width - margin + 4, margin - 4);
    ctx.lineTo(width - margin + 4, margin + cSize);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(margin - 4, height - margin - cSize);
    ctx.lineTo(margin - 4, height - margin + 4);
    ctx.lineTo(margin + cSize, height - margin + 4);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(width - margin + 4 - cSize, height - margin + 4);
    ctx.lineTo(width - margin + 4, height - margin + 4);
    ctx.lineTo(width - margin + 4, height - margin - cSize);
    ctx.stroke();
  }

  // 3. Header Masthead or Category Badge
  let contentStartY = 200;

  if (theme === 'magazine') {
    // Magazine Masthead title at top
    ctx.fillStyle = p.accent;
    ctx.font = '800 24px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COLLECTOR & CURATED SERIES', width / 2, 110);

    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 125);
    ctx.lineTo(width - 100, 125);
    ctx.stroke();
    contentStartY = 165;
  } else {
    // Standard Pill Badge
    const badgeY = 115;
    const badgeText = p.badgeLabel;
    ctx.font = 'bold 18px Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    const badgeMetrics = ctx.measureText(badgeText);
    const badgeWidth = badgeMetrics.width + 48;
    const badgeHeight = 38;

    ctx.fillStyle = p.badgeBg;
    roundRect(ctx, (width - badgeWidth) / 2, badgeY, badgeWidth, badgeHeight, 19);
    ctx.fill();
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = p.badgeText;
    ctx.fillText(badgeText, width / 2, badgeY + 25);
    contentStartY = 195;
  }

  // 4. Center Featured Graphic Card
  let textBlockStartY = contentStartY;
  const imgBoxW = width - 240;
  const imgBoxH = height * 0.44;
  const imgBoxX = 120;
  const imgBoxY = contentStartY;

  let loadedImg: HTMLImageElement | null = null;
  const sourceUrl = options.sampleImage?.previewUrl || options.sampleImage?.dataUrl;

  if (sourceUrl) {
    try {
      loadedImg = await loadImageAsync(sourceUrl);
    } catch {
      loadedImg = null;
    }
  }

  // Draw card container
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 14;

  ctx.fillStyle = p.cardBg;
  roundRect(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 20);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = p.border;
  ctx.lineWidth = 2;
  roundRect(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 20);
  ctx.stroke();

  if (loadedImg) {
    // Clip and draw real image with professional contain/cover
    ctx.save();
    roundRect(ctx, imgBoxX + 12, imgBoxY + 12, imgBoxW - 24, imgBoxH - 24, 14);
    ctx.clip();

    const imgAspect = (loadedImg.width || 1) / (loadedImg.height || 1);
    const boxAspect = (imgBoxW - 24) / (imgBoxH - 24);
    let renderW = imgBoxW - 24;
    let renderH = imgBoxH - 24;
    let renderX = imgBoxX + 12;
    let renderY = imgBoxY + 12;

    if (imgAspect > boxAspect) {
      renderH = renderW / imgAspect;
      renderY = imgBoxY + 12 + ((imgBoxH - 24) - renderH) / 2;
    } else {
      renderW = renderH * imgAspect;
      renderX = imgBoxX + 12 + ((imgBoxW - 24) - renderW) / 2;
    }

    ctx.drawImage(loadedImg, renderX, renderY, renderW, renderH);
    ctx.restore();
  } else {
    // Elegant fallback graphic if no sample image yet
    drawCoverAbstractEmblem(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, p, theme);
  }

  textBlockStartY = imgBoxY + imgBoxH + 55;

  // 5. Title Rendering (High-impact & wrapped)
  const title = options.title || 'Curated eBook Collection';
  ctx.fillStyle = p.textPrimary;
  ctx.textAlign = 'center';

  const maxTitleWidth = width - 200;
  const titleFontSize = title.length > 45 ? 44 : title.length > 25 ? 52 : 62;
  ctx.font = p.serifTitle
    ? `bold ${titleFontSize}px Georgia, "Times New Roman", serif`
    : `bold ${titleFontSize}px Outfit, -apple-system, sans-serif`;

  const titleLines = wrapText(ctx, title, maxTitleWidth);
  let currentY = textBlockStartY;
  const titleLineHeight = titleFontSize * 1.25;

  for (const line of titleLines) {
    ctx.fillText(line, width / 2, currentY);
    currentY += titleLineHeight;
  }

  // 6. Subtitle
  const subtitle = options.subtitle || 'High-Resolution Curated Pages • Complete Edition';
  currentY += 15;
  ctx.fillStyle = p.accent;
  const subFontSize = 24;
  ctx.font = `600 ${subFontSize}px Outfit, -apple-system, sans-serif`;
  const subLines = wrapText(ctx, subtitle, maxTitleWidth);
  for (const sline of subLines) {
    ctx.fillText(sline, width / 2, currentY);
    currentY += subFontSize * 1.35;
  }

  // 7. Theme-specific Ornamental Divider
  currentY += 24;
  if (theme === 'elegant' || theme === 'vintage') {
    ctx.fillStyle = p.accent;
    ctx.font = '22px Georgia, serif';
    ctx.fillText('✦   ✦   ✦', width / 2, currentY);
  } else {
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 50, currentY);
    ctx.lineTo(width / 2 + 50, currentY);
    ctx.stroke();
  }

  // 8. Footer Section & Barcode / Author Stamp
  const footerY = height - 90;
  const authorText = options.author ? `Curated by ${options.author}` : 'Official Publication Series';

  ctx.fillStyle = p.textSecondary;
  ctx.font = '20px Outfit, -apple-system, sans-serif';
  ctx.textAlign = p.showBarcode ? 'left' : 'center';

  if (p.showBarcode) {
    // Author on left, realistic barcode on right
    ctx.fillText(authorText, 120, footerY);
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = p.textSecondary;
    ctx.fillText('ISBN 978-0-2026-PDF', 120, footerY + 24);

    // Draw mini barcode
    drawBarcode(ctx, width - 260, footerY - 18, 140, 36, p.textSecondary);
  } else {
    ctx.fillText(authorText, width / 2, footerY);
    ctx.font = '15px Outfit, -apple-system, sans-serif';
    ctx.fillStyle = p.accent;
    ctx.fillText('ALL RIGHTS RESERVED • HIGH-QUALITY DIGITAL PRINTABLE', width / 2, footerY + 26);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fill();
}

function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  const barPattern = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 2, 1, 3, 1, 2];
  let curX = x;
  for (let i = 0; i < barPattern.length && curX < x + w; i++) {
    const barW = barPattern[i];
    if (i % 2 === 0) {
      ctx.fillRect(curX, y, barW, h);
    }
    curX += barW + 2;
  }
}

function drawCoverAbstractEmblem(
  ctx: CanvasRenderingContext2D,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  p: any,
  theme: string
) {
  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2;

  // Outer decorative ring
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 90, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ring
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 110, 0, Math.PI * 2);
  ctx.stroke();

  // Icon / symbol in center
  ctx.fillStyle = p.accent;
  ctx.font = 'bold 36px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(theme === 'nature' ? '🌿' : theme === 'elegant' ? '✦' : 'PDF', cx, cy);

  ctx.font = '16px Outfit, sans-serif';
  ctx.fillStyle = p.textSecondary;
  ctx.fillText('CURATED DIGITAL WORK', cx, cy + 45);
  ctx.textBaseline = 'alphabetic';
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.slice(0, 4); // max 4 lines
}

function loadImageAsync(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}
