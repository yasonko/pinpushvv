import { EbookImageItem } from '../../types/ebook';

/**
 * Natural Alphanumeric Comparison (handles 1, 2, 10, 100 correctly)
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Extracts sequence numbers if present in filename (e.g. "image_004.jpg" -> 4)
 */
export function extractLeadingOrTrailingNumber(filename: string): number | null {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const matches = nameWithoutExt.match(/\d+/g);
  if (matches && matches.length > 0) {
    // Prefer the last numeric token in the filename (e.g. page_012 -> 12)
    const num = parseInt(matches[matches.length - 1], 10);
    if (!isNaN(num)) return num;
  }
  return null;
}

/**
 * Sorts array of EbookImageItems by natural filename order
 */
export function sortImagesNaturally(
  items: EbookImageItem[],
  direction: 'asc' | 'desc' = 'asc'
): EbookImageItem[] {
  const sorted = [...items].sort((a, b) => {
    const cmp = naturalCompare(a.filename, b.filename);
    return direction === 'asc' ? cmp : -cmp;
  });

  return sorted.map((item, idx) => ({
    ...item,
    sequenceNumber: idx + 1,
  }));
}

/**
 * Sorts by original upload order
 */
export function sortByUploadOrder(items: EbookImageItem[]): EbookImageItem[] {
  const sorted = [...items].sort((a, b) => a.originalIndex - b.originalIndex);
  return sorted.map((item, idx) => ({
    ...item,
    sequenceNumber: idx + 1,
  }));
}

/**
 * Re-indexes sequence numbers after manual reordering / deletion
 */
export function reindexImageSequences(items: EbookImageItem[]): EbookImageItem[] {
  return items.map((item, idx) => ({
    ...item,
    sequenceNumber: idx + 1,
  }));
}

/**
 * Move item up in the list
 */
export function moveImageItem(
  items: EbookImageItem[],
  fromIndex: number,
  toIndex: number
): EbookImageItem[] {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
    return items;
  }
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return reindexImageSequences(result);
}

/**
 * Cleans filename to a human-readable title candidate if no title is present
 */
export function deriveTitleFromFilename(filename: string): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  return nameWithoutExt
    .replace(/[_\-.]+/g, ' ')
    .replace(/\b\d+\b/g, '') // remove standalone numbers
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
