import { Pin, Board } from '../types';
import { isPublicHttpsUrl } from './imageStorageService';
import { CsvTimeFormat, convertTo12Hour, convertTo24Hour, pad2 } from './bulkScheduleService';
import { normalizeTitleForComparison, detectDuplicateTitles } from './titleDuplicateService';

export { isPublicHttpsUrl };
export type { CsvTimeFormat };

/**
 * Pinterest Bulk Upload Official CSV Header Specification
 * Exact 8 columns in exact order required by Pinterest:
 * Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords
 */
export const PINTEREST_CSV_COLUMNS = [
  'Title',
  'Media URL',
  'Pinterest board',
  'Thumbnail',
  'Description',
  'Link',
  'Publish date',
  'Keywords'
] as const;

export const PINTEREST_CSV_HEADER_ROW = PINTEREST_CSV_COLUMNS.join(',');

export interface PinExportValidation {
  pinId: string;
  pinNumber: number;
  title: string;
  filename: string;
  isValid: boolean;
  hasPublicMediaUrl: boolean;
  isDuplicateTitle: boolean;
  titleCharacterCount: number;
  descriptionCharacterCount: number;
  missingFields: string[];
  warningFields: string[];
  errorDetails?: string[];
}

export interface BatchExportValidation {
  totalCount: number;
  validCount: number;
  invalidCount: number;
  duplicateTitlesCount: number;
  hasDuplicateTitles: boolean;
  problematicPins: PinExportValidation[];
  allValidations: PinExportValidation[];
  needsImageUploadCount: number;
}

export interface CsvRowValidation {
  rowIndex: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * RFC 4180 Compliant CSV Field Escaper
 * Safely escapes quotes, commas, newlines, Arabic/European characters, and emojis.
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str === '') return '';

  // If string contains comma, double-quote, carriage return or newline, wrap in quotes and escape quotes with ""
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats keywords/tags into a single comma-separated string for the Keywords column.
 */
export function formatKeywordsForCsv(tags?: string[] | string): string {
  if (!tags) return '';
  if (Array.isArray(tags)) {
    return tags
      .map(t => String(t).trim())
      .filter(Boolean)
      .join(', ');
  }
  return String(tags).trim();
}

/**
 * Formats publish date cleanly for Pinterest Bulk Upload.
 * Default 12-hour format: YYYY-MM-DD hh:mm AM/PM (e.g. 2026-08-24 12:30 PM, 2026-08-24 01:00 PM)
 * Optional US 12-hour: MM/DD/YYYY hh:mm AM/PM (e.g. 08/24/2026 01:00 PM)
 * Optional 24-hour: YYYY-MM-DD HH:MM (e.g. 2026-08-24 13:00)
 * Preserves exact local user date & time without UTC offset shifting.
 */
export function formatPublishDateForCsv(
  dateStr?: string | null,
  format: CsvTimeFormat = '12h'
): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (!trimmed) return '';

  let year: number;
  let month: number; // 1-12
  let day: number;
  let hours24: number = 0;
  let minutes: number = 0;

  // 1. Check for 12-hour format with AM/PM already: "YYYY-MM-DD hh:mm AM/PM" or "MM/DD/YYYY hh:mm AM/PM"
  const ampmMatchIso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  const ampmMatchUs = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);

  if (ampmMatchIso) {
    year = parseInt(ampmMatchIso[1], 10);
    month = parseInt(ampmMatchIso[2], 10);
    day = parseInt(ampmMatchIso[3], 10);
    const rawH = parseInt(ampmMatchIso[4], 10);
    minutes = parseInt(ampmMatchIso[5], 10);
    hours24 = convertTo24Hour(rawH, ampmMatchIso[6].toUpperCase() as 'AM' | 'PM');
  } else if (ampmMatchUs) {
    month = parseInt(ampmMatchUs[1], 10);
    day = parseInt(ampmMatchUs[2], 10);
    year = parseInt(ampmMatchUs[3], 10);
    const rawH = parseInt(ampmMatchUs[4], 10);
    minutes = parseInt(ampmMatchUs[5], 10);
    hours24 = convertTo24Hour(rawH, ampmMatchUs[6].toUpperCase() as 'AM' | 'PM');
  } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed)) {
    // 2. ISO or standard format: YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM
    const sep = trimmed.includes('T') ? 'T' : ' ';
    const parts = trimmed.split(sep);
    const dateParts = parts[0].split('-').map(Number);
    year = dateParts[0];
    month = dateParts[1];
    day = dateParts[2];

    const timePart = (parts[1] || '').replace(/Z|[+-]\d{2}(?::?\d{2})?$/i, '');
    const timeParts = timePart.split(':').map(Number);
    hours24 = timeParts[0] || 0;
    minutes = timeParts[1] || 0;
  } else {
    // 3. Fallback date parse
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) {
      return trimmed;
    }
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
    hours24 = d.getHours();
    minutes = d.getMinutes();
  }

  const { hour12Str, ampm } = convertTo12Hour(hours24);

  if (format === '12h_us') {
    // MM/DD/YYYY hh:mm AM/PM (e.g. 08/24/2026 01:00 PM)
    return `${pad2(month)}/${pad2(day)}/${year} ${hour12Str}:${pad2(minutes)} ${ampm}`;
  } else if (format === '24h') {
    // YYYY-MM-DD HH:MM (e.g. 2026-08-24 13:00)
    return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hours24)}:${pad2(minutes)}`;
  } else {
    // Default '12h': Standard 12-hour format for Pinterest (YYYY-MM-DD hh:mm AM/PM e.g. 2026-08-24 01:00 PM)
    return `${year}-${pad2(month)}-${pad2(day)} ${hour12Str}:${pad2(minutes)} ${ampm}`;
  }
}

/**
 * Parses publish date string into an ISO string or null
 */
export function parseCsvPublishDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;

  try {
    // 1. Check for 12-hour AM/PM formats
    const ampmMatchIso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    const ampmMatchUs = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);

    if (ampmMatchIso) {
      const year = parseInt(ampmMatchIso[1], 10);
      const month = parseInt(ampmMatchIso[2], 10);
      const day = parseInt(ampmMatchIso[3], 10);
      const rawH = parseInt(ampmMatchIso[4], 10);
      const minutes = parseInt(ampmMatchIso[5], 10);
      const hour24 = convertTo24Hour(rawH, ampmMatchIso[6].toUpperCase() as 'AM' | 'PM');
      return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour24)}:${pad2(minutes)}:00`;
    }

    if (ampmMatchUs) {
      const month = parseInt(ampmMatchUs[1], 10);
      const day = parseInt(ampmMatchUs[2], 10);
      const year = parseInt(ampmMatchUs[3], 10);
      const rawH = parseInt(ampmMatchUs[4], 10);
      const minutes = parseInt(ampmMatchUs[5], 10);
      const hour24 = convertTo24Hour(rawH, ampmMatchUs[6].toUpperCase() as 'AM' | 'PM');
      return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour24)}:${pad2(minutes)}:00`;
    }

    // 2. Standard ISO / Date parse
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed)) {
      const sep = trimmed.includes('T') ? 'T' : ' ';
      const parts = trimmed.split(sep);
      const dateParts = parts[0].split('-').map(Number);
      const timePart = (parts[1] || '').replace(/Z|[+-]\d{2}(?::?\d{2})?$/i, '');
      const timeParts = timePart.split(':').map(Number);
      return `${dateParts[0]}-${pad2(dateParts[1])}-${pad2(dateParts[2])}T${pad2(timeParts[0] || 0)}:${pad2(timeParts[1] || 0)}:00`;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates pins before exporting, identifying any missing critical fields for Pinterest
 * as well as duplicate titles across the batch.
 */
export function validatePinsForExport(pins: Pin[], boards: Board[]): BatchExportValidation {
  const boardMap = new Map<string, string>(boards.map(b => [b.id, b.name]));
  let needsImageUploadCount = 0;

  // Run Duplicate Title Scanner across the entire batch
  const duplicateScan = detectDuplicateTitles(pins);

  const allValidations: PinExportValidation[] = pins.map((pin, index) => {
    const missing: string[] = [];
    const warnings: string[] = [];
    const errorDetails: string[] = [];

    const title = (pin.title || pin.filename || '').trim();
    const rawImage = (pin.imageUrl || pin.mediaUrl || pin.thumbnailUrl || '').trim();
    const hasPublicUrl = isPublicHttpsUrl(pin.mediaUrl) || isPublicHttpsUrl(pin.imageUrl);
    const boardName = pin.boardId ? (boardMap.get(pin.boardId) || pin.boardId) : '';
    const description = (pin.description || '').trim();
    const link = (pin.destinationUrl || '').trim();

    const isDuplicate = duplicateScan.duplicatePinIds.has(pin.id);

    if (!title) {
      missing.push('Title');
      errorDetails.push('Missing Title');
    } else if (title.length > 100) {
      missing.push('Title exceeds 100 characters');
      errorDetails.push(`Title is too long (${title.length}/100 chars)`);
    }

    if (isDuplicate) {
      missing.push('Duplicate Title (Pinterest rejects duplicates)');
      errorDetails.push(`Duplicate title detected: "${title}" is used on another Pin`);
    }

    if (!rawImage) {
      missing.push('Media URL (Missing Image)');
      errorDetails.push('Missing Image');
    } else if (!hasPublicUrl) {
      needsImageUploadCount++;
    }
    if (!boardName) {
      missing.push('Pinterest board');
      errorDetails.push('Missing Pinterest Board');
    }

    if (!description) {
      warnings.push('Description');
    } else if (description.length > 500) {
      warnings.push('Description exceeds 500 characters');
    }

    if (!link) {
      warnings.push('Link');
    }

    const isValid = missing.length === 0;

    return {
      pinId: pin.id,
      pinNumber: index + 1,
      title: title || pin.filename || `Pin #${index + 1}`,
      filename: pin.filename || `pin_${index + 1}.jpg`,
      isValid,
      hasPublicMediaUrl: hasPublicUrl,
      isDuplicateTitle: isDuplicate,
      titleCharacterCount: title.length,
      descriptionCharacterCount: description.length,
      missingFields: missing,
      warningFields: warnings,
      errorDetails,
    };
  });

  const problematicPins = allValidations.filter(v => !v.isValid);
  const validCount = allValidations.length - problematicPins.length;

  return {
    totalCount: pins.length,
    validCount,
    invalidCount: problematicPins.length,
    duplicateTitlesCount: duplicateScan.duplicatesCount,
    hasDuplicateTitles: duplicateScan.hasDuplicates,
    problematicPins,
    allValidations,
    needsImageUploadCount,
  };
}

/**
 * Generates the complete Pinterest Bulk Upload CSV text.
 * Exact 8 columns in exact order:
 * Title,Media URL,Pinterest board,Thumbnail,Description,Link,Publish date,Keywords
 */
export function generatePinterestCSV(
  pins: Pin[], 
  boards: Board[] = [],
  options?: { timeFormat?: CsvTimeFormat; skipDuplicateCheck?: boolean }
): string {
  const safeBoards = Array.isArray(boards) ? boards : [];
  const boardMap = new Map<string, string>(safeBoards.map(b => [b.id, b.name]));
  const timeFormat = options?.timeFormat || '12h';

  // Strict Duplicate Check unless explicitly skipped
  if (!options?.skipDuplicateCheck) {
    const dupScan = detectDuplicateTitles(pins);
    if (dupScan.hasDuplicates) {
      throw new Error(
        `Pinterest CSV Export Blocked: ${dupScan.duplicatesCount} duplicate title(s) detected. Pinterest Bulk Upload will reject CSVs containing duplicate rows with the same title. Please resolve duplicates before downloading.`
      );
    }
  }

  const rows = pins.map(pin => {
    // 1. Title -> Pin title (Max 100 characters for Pinterest)
    const title = (pin.title || pin.filename || '').trim().slice(0, 100);
    
    // 2. Media URL -> Valid Public HTTPS URL
    const mediaUrl = (pin.mediaUrl && isPublicHttpsUrl(pin.mediaUrl))
      ? pin.mediaUrl
      : (pin.imageUrl && isPublicHttpsUrl(pin.imageUrl) ? pin.imageUrl : (pin.mediaUrl || pin.imageUrl || ''));
    
    // 3. Pinterest board -> Selected Pinterest board
    const boardName = pin.boardId ? (boardMap.get(pin.boardId) || pin.boardId) : '';
    
    // 4. Thumbnail -> Always EMPTY for image Pins as required by Pinterest CSV standard
    const thumbnail = '';
    
    // 5. Description -> Pin description (Max 500 characters)
    const description = (pin.description || '').trim().slice(0, 500);
    
    // 6. Link -> Destination website URL
    const link = pin.destinationUrl || '';
    
    // 7. Publish date -> Scheduled/publish date (12-hour AM/PM format by default)
    const publishDate = formatPublishDateForCsv(pin.scheduledAt || pin.publishedAt, timeFormat);
    
    // 8. Keywords -> Pin keywords (comma separated in one field)
    const keywords = formatKeywordsForCsv(pin.tags);

    return [
      escapeCsvField(title),
      escapeCsvField(mediaUrl),
      escapeCsvField(boardName),
      escapeCsvField(thumbnail),
      escapeCsvField(description),
      escapeCsvField(link),
      escapeCsvField(publishDate),
      escapeCsvField(keywords)
    ].join(',');
  });

  return [PINTEREST_CSV_HEADER_ROW, ...rows].join('\n');
}

/**
 * Triggers a client-side browser download of the Pinterest CSV file with UTF-8 BOM.
 * File name: pinterest-bulk-upload.csv
 */
export function downloadPinterestCSV(
  pins: Pin[], 
  boards: Board[], 
  filename = 'pinterest-bulk-upload.csv',
  options?: { timeFormat?: CsvTimeFormat }
): void {
  const csvContent = generatePinterestCSV(pins, boards, options);
  // Prepend UTF-8 BOM (\uFEFF) to guarantee Excel, Numbers, and Pinterest properly recognize Unicode/Arabic/European chars
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Full RFC 4180 CSV Tokenizer and Matrix Parser
 * Handles multiline quoted cells, commas in quotes, escaped quotes, and Unicode.
 */
export function parseCSVMatrix(csvText: string): string[][] {
  if (!csvText || !csvText.trim()) return [];

  // Strip BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.substring(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of \r\n
      }
      currentRow.push(currentCell);
      currentCell = '';
      if (currentRow.length > 0 && currentRow.some(cell => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  // Push final cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some(cell => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Robust CSV parser for backward compatibility and general import.
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  const matrix = parseCSVMatrix(csvText);
  if (matrix.length === 0) return [];

  const headers = matrix[0].map(h => h.trim().toLowerCase().replace(/[\s_-]+/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const values = matrix[i];
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index].trim() : '';
    });
    rows.push(rowObj);
  }

  return rows;
}

export interface PinterestCsvImportResult {
  success: boolean;
  error?: string;
  pins: Pin[];
  newBoardsToCreate: Board[];
  totalRows: number;
  validRowsCount: number;
}

/**
 * Strict Pinterest CSV Import Parser
 * Validates the exact 8 headers:
 * Title, Media URL, Pinterest board, Thumbnail, Description, Link, Publish date, Keywords
 */
export function parsePinterestBulkUploadCSV(
  csvText: string,
  existingBoards: Board[]
): PinterestCsvImportResult {
  const matrix = parseCSVMatrix(csvText);

  if (matrix.length === 0) {
    return {
      success: false,
      error: 'CSV file is empty.',
      pins: [],
      newBoardsToCreate: [],
      totalRows: 0,
      validRowsCount: 0
    };
  }

  const rawHeaders = matrix[0].map(h => h.trim());
  const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[\s_-]+/g, ' '));

  // Verify header structure for Pinterest
  const requiredColumns = [
    'title',
    'media url',
    'pinterest board',
    'thumbnail',
    'description',
    'link',
    'publish date',
    'keywords'
  ];

  const headerMatches = requiredColumns.every(req => 
    normalizedHeaders.includes(req) ||
    // Accept standard variations
    (req === 'media url' && (normalizedHeaders.includes('media url') || normalizedHeaders.includes('image url') || normalizedHeaders.includes('image'))) ||
    (req === 'pinterest board' && (normalizedHeaders.includes('pinterest board') || normalizedHeaders.includes('board'))) ||
    (req === 'publish date' && (normalizedHeaders.includes('publish date') || normalizedHeaders.includes('date') || normalizedHeaders.includes('scheduled date')))
  );

  if (!headerMatches && rawHeaders.length !== 8) {
    return {
      success: false,
      error: `Invalid Pinterest CSV format.\n\nExpected columns:\nTitle, Media URL, Pinterest board, Thumbnail, Description, Link, Publish date, Keywords`,
      pins: [],
      newBoardsToCreate: [],
      totalRows: matrix.length - 1,
      validRowsCount: 0
    };
  }

  // Header index resolution
  const getIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = normalizedHeaders.findIndex(h => h === name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const titleIdx = getIndex(['title', 'pin title']);
  const mediaUrlIdx = getIndex(['media url', 'image url', 'image', 'url_image']);
  const boardIdx = getIndex(['pinterest board', 'board', 'board name']);
  const thumbnailIdx = getIndex(['thumbnail', 'thumb']);
  const descIdx = getIndex(['description', 'pin description']);
  const linkIdx = getIndex(['link', 'destination url', 'url', 'destination']);
  const dateIdx = getIndex(['publish date', 'scheduled date', 'date', 'time']);
  const keywordsIdx = getIndex(['keywords', 'tags', 'pin tags']);

  const safeBoards = Array.isArray(existingBoards) ? existingBoards : [];
  const boardMap = new Map<string, string>(
    safeBoards
      .filter(b => b && typeof b.name === 'string')
      .map(b => [(b.name || '').toLowerCase().trim(), b.id || ''])
  );
  const newBoardsToCreate: Board[] = [];
  const createdPins: Pin[] = [];
  const now = new Date().toISOString();

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length === 0 || row.every(c => !c || !String(c).trim())) continue;

    const title = (titleIdx !== -1 && row[titleIdx] !== undefined) ? String(row[titleIdx] || '').trim() : String(row[0] || '').trim();
    const mediaUrl = (mediaUrlIdx !== -1 && row[mediaUrlIdx] !== undefined) ? String(row[mediaUrlIdx] || '').trim() : String(row[1] || '').trim();
    const boardName = (boardIdx !== -1 && row[boardIdx] !== undefined) ? String(row[boardIdx] || '').trim() : String(row[2] || '').trim();
    const thumbnail = (thumbnailIdx !== -1 && row[thumbnailIdx] !== undefined) ? String(row[thumbnailIdx] || '').trim() : String(row[3] || '').trim();
    const description = (descIdx !== -1 && row[descIdx] !== undefined) ? String(row[descIdx] || '').trim() : String(row[4] || '').trim();
    const link = (linkIdx !== -1 && row[linkIdx] !== undefined) ? String(row[linkIdx] || '').trim() : String(row[5] || '').trim();
    const publishDate = (dateIdx !== -1 && row[dateIdx] !== undefined) ? String(row[dateIdx] || '').trim() : String(row[6] || '').trim();
    const keywordsRaw = (keywordsIdx !== -1 && row[keywordsIdx] !== undefined) ? String(row[keywordsIdx] || '').trim() : String(row[7] || '').trim();

    // Board resolution & creation
    let targetBoardId: string | undefined = undefined;
    if (boardName) {
      const lowerBoard = boardName.toLowerCase();
      if (boardMap.has(lowerBoard)) {
        targetBoardId = boardMap.get(lowerBoard);
      } else {
        const newBoard: Board = {
          id: `board_csv_${Date.now()}_${i}`,
          name: boardName,
          createdAt: now,
        };
        newBoardsToCreate.push(newBoard);
        boardMap.set(lowerBoard, newBoard.id);
        targetBoardId = newBoard.id;
      }
    }

    // Schedule Parsing (supports 12h AM/PM, ISO, and standard dates)
    let scheduledAt: string | null = null;
    let status: Pin['status'] = 'draft';
    if (publishDate) {
      const parsedIso = parseCsvPublishDate(publishDate);
      if (parsedIso) {
        scheduledAt = parsedIso;
        status = 'scheduled';
      }
    }

    // Tags extraction
    const tags = keywordsRaw
      ? keywordsRaw.split(/[,;\n]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)
      : [];

    // Image fallback placeholder
    let imageUrl = mediaUrl || thumbnail;
    let finalThumbnail = thumbnail || imageUrl;
    if (!imageUrl) {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, 400, 600);
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(title || `Pin #${i}`, 30, 200);
        imageUrl = canvas.toDataURL('image/jpeg', 0.8);
        finalThumbnail = imageUrl;
      }
    }

    const pin: Pin = {
      id: `pin_csv_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      filename: (title ? `${title.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}.jpg` : `pin_${i}.jpg`),
      imageUrl: imageUrl || '',
      thumbnailUrl: finalThumbnail || imageUrl || '',
      title: title || `Pin #${i}`,
      description: description || '',
      altText: title || description || '',
      tags,
      destinationUrl: link || '',
      boardId: targetBoardId,
      status,
      aiStatus: (title && description) ? 'completed' : 'pending',
      aiGenerated: false,
      titleManuallyEdited: !!title,
      descriptionManuallyEdited: !!description,
      tagsManuallyEdited: tags.length > 0,
      scheduledAt,
      publishedAt: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };

    createdPins.push(pin);
  }

  return {
    success: true,
    pins: createdPins,
    newBoardsToCreate,
    totalRows: matrix.length - 1,
    validRowsCount: createdPins.length
  };
}

/**
 * Validates rows from standard CSV for UI preview
 */
export function validateCsvRows(rows: Record<string, string>[], existingBoards: Board[]): CsvRowValidation[] {
  const boardNames = new Set(existingBoards.map(b => b.name.toLowerCase()));

  return rows.map((row, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const filename = row['filename'] || row['file_name'] || row['image'] || row['media_url'] || '';
    const imageUrl = row['image_url'] || row['imageurl'] || row['url_image'] || row['media_url'] || '';
    const title = row['title'] || row['pin_title'] || '';
    const destinationUrl = row['destination_url'] || row['url'] || row['link'] || '';
    const board = row['board'] || row['board_name'] || row['pinterest_board'] || '';
    const scheduledDate = row['scheduled_date'] || row['date'] || row['publish_date'] || '';
    const scheduledTime = row['scheduled_time'] || row['time'] || '';

    if (!filename && !imageUrl) {
      errors.push('Row missing both filename and image/media URL');
    }

    if (!title && !filename) {
      warnings.push('Title is empty; filename will be used as default title');
    }

    if (board && !boardNames.has(board.toLowerCase())) {
      warnings.push(`Board "${board}" does not exist yet and will be created automatically`);
    }

    if (scheduledDate) {
      const parsed = Date.parse(scheduledDate);
      if (isNaN(parsed)) {
        errors.push(`Invalid date format: "${scheduledDate}". Expected YYYY-MM-DD or ISO`);
      }
    }

    if (scheduledTime) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(scheduledTime.trim())) {
        warnings.push(`Scheduled time "${scheduledTime}" should be in HH:MM format`);
      }
    }

    return {
      rowIndex: idx + 1,
      data: {
        filename,
        imageUrl,
        title: title || (filename ? filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ') : `Pin #${idx + 1}`),
        description: row['description'] || row['pin_description'] || '',
        altText: row['alt_text'] || row['alt'] || '',
        destinationUrl,
        board,
        scheduledDate,
        scheduledTime,
      },
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  });
}

/**
 * Standard legacy export wrapper
 */
export function exportPinsToCSV(pins: Pin[], boards: Board[]): string {
  return generatePinterestCSV(pins, boards);
}
