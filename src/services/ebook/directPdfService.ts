import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { uploadPdfWithRetry, getSavedStorageConfig, isRealPublicPdfUrl } from './pdfStorageService';
import { StorageConfig } from '../../types/ebook';
import { formatBytes } from './excelGenerator';
import { triggerBlobDownload } from './ebookZipService';

export interface DirectPdfItem {
  id: string;
  file?: File;
  filename: string;
  title: string;
  fileSizeBytes: number;
  pageCount?: number;
  uploadStatus: 'idle' | 'uploading' | 'completed' | 'failed';
  uploadProgress: number; // 0 - 100
  publicUrl?: string;
  storageProvider?: string;
  uploadedAt?: string;
  error?: string;
  seoKeywords?: string[];
  seoDescription?: string;
  websiteUrl?: string;
}

export const DIRECT_PDF_SHEET_COLUMNS = [
  'Title',
  'PDF URL',
  'File Name',
  'File Size',
  'Pages',
  'Upload Date',
  'Storage Provider',
  'SEO Keywords',
  'SEO Description',
] as const;

// Ensure worker is configured for PDF.js (header extraction only, no canvas rendering)
try {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
} catch {
  // worker fallback
}

/**
 * Extracts rapid metadata (page count and clean title) from a PDF file WITHOUT rendering pages or canvas.
 * Extremely fast and uses minimal memory.
 */
export async function extractFastPdfMetadata(file: File): Promise<{
  pageCount: number;
  title: string;
  size: number;
}> {
  const cleanTitle = file.name
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  let pageCount = 1;

  try {
    const arrayBuffer = await file.slice(0, Math.min(file.size, 1024 * 1024 * 5)).arrayBuffer();
    // Try fast text parsing of /Count in PDF catalog dictionary
    const bytes = new Uint8Array(arrayBuffer);
    const text = new TextDecoder('latin1').decode(bytes);
    const countMatch = text.match(/\/Count\s+(\d+)/);
    if (countMatch && countMatch[1]) {
      const parsed = parseInt(countMatch[1], 10);
      if (parsed > 0 && parsed < 100000) {
        pageCount = parsed;
        return { pageCount, title: cleanTitle, size: file.size };
      }
    }
  } catch {
    // Fallback to pdfjs
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    });
    const pdf = await loadingTask.promise;
    pageCount = pdf.numPages || 1;
  } catch {
    pageCount = 1;
  }

  return {
    pageCount,
    title: cleanTitle,
    size: file.size,
  };
}

/**
 * Uploads a single DirectPdfItem to the configured storage provider (with automatic retries)
 */
export async function uploadDirectPdfFile(
  item: DirectPdfItem,
  config?: StorageConfig,
  onProgress?: (pct: number) => void
): Promise<{
  publicUrl: string;
  storageProvider: string;
  uploadedAt: string;
}> {
  if (!item.file) {
    throw new Error('No PDF file object found to upload');
  }

  const activeConfig = config || getSavedStorageConfig();
  const res = await uploadPdfWithRetry(item.file, item.filename, activeConfig, 3, onProgress);

  return {
    publicUrl: res.publicUrl,
    storageProvider: res.provider || activeConfig.provider,
    uploadedAt: res.uploadedAt || new Date().toISOString(),
  };
}

/**
 * Builds an Excel (.xlsx) workbook Blob for the direct uploaded PDF items.
 * Includes clickable hyperlinks for PDF URLs and clean column widths.
 */
export function generateDirectPdfExcelWorkbook(
  items: DirectPdfItem[],
  customFilenamePrefix?: string
): Blob {
  const rows = items.map((item) => {
    const candidateUrl = item.publicUrl || '';
    const cleanPdfUrl = isRealPublicPdfUrl(candidateUrl) ? candidateUrl : candidateUrl;

    const keywords = Array.isArray(item.seoKeywords)
      ? item.seoKeywords.join(', ')
      : `${item.title.toLowerCase()}, printable pdf, digital download`;

    const description =
      item.seoDescription ||
      `Direct download link for ${item.title}. High-quality PDF document (${formatBytes(
        item.fileSizeBytes
      )}${item.pageCount ? `, ${item.pageCount} pages` : ''}).`;

    return {
      'Title': item.title || item.filename.replace(/\.pdf$/i, ''),
      'PDF URL': cleanPdfUrl,
      'File Name': item.filename,
      'File Size': formatBytes(item.fileSizeBytes),
      'Pages': item.pageCount || 1,
      'Upload Date': item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : new Date().toLocaleDateString(),
      'Storage Provider': item.storageProvider || 'Cloud Storage',
      'SEO Keywords': keywords,
      'SEO Description': description,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...DIRECT_PDF_SHEET_COLUMNS],
  });

  // Attach clickable hyperlinks to 'PDF URL' cells
  const pdfUrlColIndex = DIRECT_PDF_SHEET_COLUMNS.indexOf('PDF URL');

  items.forEach((item, rowIndex) => {
    const sheetRowNumber = rowIndex + 2; // Row 1 is header (1-indexed)
    const url = item.publicUrl;

    if (url && pdfUrlColIndex !== -1 && url.startsWith('http')) {
      const cellAddress = XLSX.utils.encode_cell({ r: sheetRowNumber - 1, c: pdfUrlColIndex });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].l = {
          Target: url,
          Tooltip: `Click to view or download ${item.filename}`,
        };
      }
    }
  });

  // Auto-fit column widths
  worksheet['!cols'] = [
    { wch: 36 }, // Title
    { wch: 52 }, // PDF URL
    { wch: 30 }, // File Name
    { wch: 14 }, // File Size
    { wch: 10 }, // Pages
    { wch: 22 }, // Upload Date
    { wch: 20 }, // Storage Provider
    { wch: 38 }, // SEO Keywords
    { wch: 60 }, // SEO Description
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Uploaded_PDF_Links');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generates an RFC-4180 compliant CSV string for the uploaded PDF items.
 * Can be directly opened in Excel or imported into Google Sheets.
 */
export function generateDirectPdfCsv(items: DirectPdfItem[]): string {
  const escapeCsv = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headers = [...DIRECT_PDF_SHEET_COLUMNS].join(',');
  const lines = items.map((item) => {
    const keywords = Array.isArray(item.seoKeywords)
      ? item.seoKeywords.join(', ')
      : `${item.title.toLowerCase()}, printable pdf, digital download`;

    const description =
      item.seoDescription ||
      `Direct download link for ${item.title} (${formatBytes(item.fileSizeBytes)}).`;

    return [
      escapeCsv(item.title || item.filename.replace(/\.pdf$/i, '')),
      escapeCsv(item.publicUrl || ''),
      escapeCsv(item.filename),
      escapeCsv(formatBytes(item.fileSizeBytes)),
      escapeCsv(item.pageCount || 1),
      escapeCsv(item.uploadedAt ? new Date(item.uploadedAt).toISOString() : new Date().toISOString()),
      escapeCsv(item.storageProvider || 'Cloud Storage'),
      escapeCsv(keywords),
      escapeCsv(description),
    ].join(',');
  });

  return [headers, ...lines].join('\r\n');
}

/**
 * Exports both Excel and CSV files directly to browser download.
 */
export function exportDirectPdfSheet(
  items: DirectPdfItem[],
  format: 'xlsx' | 'csv' = 'xlsx',
  baseFilename: string = 'PDF_Uploaded_Links'
): void {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${baseFilename}_${timestamp}.${format}`;

  if (format === 'xlsx') {
    const blob = generateDirectPdfExcelWorkbook(items, baseFilename);
    triggerBlobDownload(blob, filename);
  } else {
    const csvContent = generateDirectPdfCsv(items);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerBlobDownload(blob, filename);
  }
}
