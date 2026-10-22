import { Pin, Board } from '../types';
import { formatTagsForPinterest, sanitizeTagList } from './tagsHelper';

export interface CopyPinOptions {
  includeTags?: boolean;
  includeAltText?: boolean;
  includeBoard?: boolean;
  includeUrl?: boolean;
}

/**
 * Format a single pin into a clean, human-readable block for Pinterest paste
 * Matches exact structured template:
 * TITLE:
 * Modern Bedroom Decor Ideas
 * 
 * DESCRIPTION:
 * Discover modern bedroom decor ideas...
 * 
 * URL:
 * https://example.com/bedroom
 * 
 * TAGS:
 * bedroom decor, modern bedroom, home decor
 * 
 * BOARD:
 * Bedroom Decor
 */
export function formatSinglePin(pin: Pin, boardName?: string, options: CopyPinOptions = {}): string {
  const {
    includeTags = true,
    includeBoard = false,
    includeUrl = true,
    includeAltText = true,
  } = options;

  const sections: string[] = [];

  // 1. TITLE
  if (pin.title || pin.filename) {
    sections.push(pin.title || pin.filename);
  }

  // 2. DESCRIPTION
  if (pin.description) {
    sections.push(pin.description);
  }

  // 3. DESTINATION URL
  if (includeUrl && pin.destinationUrl) {
    sections.push(pin.destinationUrl);
  }

  // 4. ALT SEO TEXT
  if (includeAltText && pin.altText) {
    sections.push(pin.altText);
  }

  // 5. TAGS
  if (includeTags && pin.tags && pin.tags.length > 0) {
    sections.push(formatTagsForPinterest(pin.tags));
  }

  // 6. BOARD (Optional)
  if (includeBoard && (boardName || pin.boardId)) {
    sections.push(boardName || pin.boardId || '');
  }

  return sections.filter(Boolean).join('\n\n');
}

/**
 * Format multiple pins (Pin Set) into standard or structured export text
 */
export function formatPinSet(
  pins: Pin[],
  boards: Board[],
  format: 'text' | 'tsv' | 'csv' | 'json' = 'text',
  options: CopyPinOptions = {}
): string {
  const boardMap = new Map(boards.map(b => [b.id, b.name]));

  if (format === 'json') {
    const exportData = pins.map(p => ({
      title: p.title || p.filename,
      description: p.description,
      tags: sanitizeTagList(p.tags || []),
      tagsFormatted: formatTagsForPinterest(p.tags || []),
      destinationUrl: p.destinationUrl,
      board: p.boardId ? boardMap.get(p.boardId) || p.boardId : '',
      altText: p.altText,
      filename: p.filename,
      scheduledAt: p.scheduledAt,
    }));
    return JSON.stringify(exportData, null, 2);
  }

  if (format === 'tsv') {
    // Tab-separated: Perfect for pasting directly into Excel / Google Sheets
    const header = ['Title', 'Description', 'Destination URL', 'Board', 'Tags', 'Alt Text', 'Filename'].join('\t');
    const rows = pins.map(p => {
      const cleanDesc = (p.description || '').replace(/[\r\n\t]+/g, ' ');
      const tagsStr = formatTagsForPinterest(p.tags || []);
      const boardStr = p.boardId ? boardMap.get(p.boardId) || '' : '';
      return [
        (p.title || p.filename).replace(/[\t\n]+/g, ' '),
        cleanDesc,
        p.destinationUrl || '',
        boardStr,
        tagsStr,
        (p.altText || '').replace(/[\t\n]+/g, ' '),
        p.filename,
      ].join('\t');
    });
    return [header, ...rows].join('\n');
  }

  if (format === 'csv') {
    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
    const header = ['Title', 'Description', 'Destination URL', 'Board', 'Tags', 'Alt Text', 'Filename'].map(escapeCsv).join(',');
    const rows = pins.map(p => {
      const tagsStr = formatTagsForPinterest(p.tags || []);
      const boardStr = p.boardId ? boardMap.get(p.boardId) || '' : '';
      return [
        escapeCsv(p.title || p.filename),
        escapeCsv(p.description || ''),
        escapeCsv(p.destinationUrl || ''),
        escapeCsv(boardStr),
        escapeCsv(tagsStr),
        escapeCsv(p.altText || ''),
        escapeCsv(p.filename),
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }

  // Default: Pretty Formatted Text list
  return pins.map((p, idx) => {
    const bName = p.boardId ? boardMap.get(p.boardId) : undefined;
    const pinBlock = formatSinglePin(p, bName, options);
    return `=== Pin #${idx + 1}: ${p.filename} ===\n${pinBlock}\n`;
  }).join('\n');
}

/**
 * Safely copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard failed, falling back to textarea execCommand:', err);
  }

  // Fallback for older browsers or restricted iframe environments
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}

/**
 * Download a Pin's image locally for manual upload to Pinterest
 */
export function downloadPinImageFile(pinOrUrl: Pin | string, filename?: string) {
  try {
    const a = document.createElement('a');
    if (typeof pinOrUrl === 'string') {
      a.href = pinOrUrl;
      a.download = filename || 'pinterest-pin.png';
    } else {
      a.href = pinOrUrl.imageUrl;
      a.download = pinOrUrl.filename || `pin_${pinOrUrl.id}.jpg`;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Failed to download pin image:', err);
  }
}

/**
 * Safely copy image to clipboard
 */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      return false;
    }
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    // Clipboard API requires image/png in many browsers
    let pngBlob = blob;
    if (blob.type !== 'image/png') {
      pngBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => {
              if (b) resolve(b);
              else reject(new Error('Canvas toBlob failed'));
            }, 'image/png');
          } else {
            reject(new Error('Canvas context failed'));
          }
        };
        img.onerror = (e) => reject(e);
        img.src = imageUrl;
      });
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngBlob,
      }),
    ]);
    return true;
  } catch (err) {
    console.warn('Failed to copy image to clipboard:', err);
    return false;
  }
}

/**
 * Open Pinterest Pin Builder in a new window/tab
 */
export function openPinterestPinBuilder() {
  const pinBuilderUrl = 'https://www.pinterest.com/pin-builder/';
  try {
    const win = window.open(pinBuilderUrl, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const a = document.createElement('a');
      a.href = pinBuilderUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('Failed to open Pinterest Pin Builder:', err);
  }
}


