import * as XLSX from 'xlsx';
import { EbookGroup, PdfSettings } from '../../types/ebook';
import { Board, Website } from '../../types';
import { isRealPublicPdfUrl } from './pdfStorageService';

export const EBOOK_EXCEL_COLUMNS = [
  'Title',
  'Image URL',
  'PDF URL',
  'SEO',
  'SEO Description',
] as const;

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Builds the simplified 5-column metadata row for an eBook group.
 * Exactly 5 columns:
 * 1. Title: Final eBook/PDF title
 * 2. Image URL: Completely empty
 * 3. PDF URL: Verified public HTTPS URL only (or empty string if not uploaded)
 * 4. SEO: Concise comma-separated search keywords
 * 5. SEO Description: Clean SEO-friendly description
 */
export function buildExcelRow(
  group: EbookGroup,
  _settings?: PdfSettings,
  _boards: Board[] = [],
  _websites: Website[] = []
): Record<string, any> {
  const m = group.metadata;
  const candidateUrl = group.pdfUrl || m?.pdfUrl || '';
  const realPdfUrl = isRealPublicPdfUrl(candidateUrl) ? candidateUrl : '';

  // 1. Title: Final eBook / PDF title generated from images
  const title = (
    m?.ebookTitle ||
    group.pdfFilename.replace(/\.pdf$/i, '') ||
    `eBook #${group.pdfNumberFormatted}`
  ).trim();

  // 2. Image URL: Completely empty for now
  const imageUrl = '';

  // 3. PDF URL: Only verified public HTTPS URL, never blob/local/temp
  const pdfUrl = realPdfUrl || '';

  // 4. SEO: Concise natural keyword phrases separated by commas
  let seo = '';
  if (Array.isArray(m?.seoKeywords) && m.seoKeywords.length > 0) {
    seo = m.seoKeywords
      .filter(Boolean)
      .map((k) => String(k).trim())
      .filter((k) => k.length > 0)
      .join(', ');
  } else if (Array.isArray(m?.pinterestKeywords) && m.pinterestKeywords.length > 0) {
    seo = m.pinterestKeywords
      .filter(Boolean)
      .map((k) => String(k).trim())
      .filter((k) => k.length > 0)
      .join(', ');
  } else if (m?.mainTopic) {
    seo = `${m.mainTopic.toLowerCase()}, printable pdf, digital ebook, guide, ideas`;
  }

  // 5. SEO Description: Clean description naturally incorporating main keywords without technical jargon
  let seoDescription = (
    m?.longDescription ||
    m?.shortDescription ||
    m?.pinterestDescription ||
    `Discover ${title}. High-quality printable PDF digital collection with creative ideas and curated pages.`
  ).trim();

  return {
    'Title': title,
    'Image URL': imageUrl,
    'PDF URL': pdfUrl,
    'SEO': seo,
    'SEO Description': seoDescription,
  };
}

/**
 * Generates an `.xlsx` workbook Blob containing exactly the 5 columns with proper widths and hyperlinks.
 */
export function generateEbookExcelWorkbook(
  groups: EbookGroup[],
  settings: PdfSettings,
  boards: Board[] = [],
  websites: Website[] = []
): Blob {
  const rows = groups.map((g) => buildExcelRow(g, settings, boards, websites));

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...EBOOK_EXCEL_COLUMNS],
  });

  // Attach clickable hyperlink to the 'PDF URL' cells if valid
  const pdfUrlColIndex = EBOOK_EXCEL_COLUMNS.indexOf('PDF URL');

  groups.forEach((g, rowIndex) => {
    const sheetRowNumber = rowIndex + 2; // Row 1 is header (1-indexed)
    const candidateUrl = g.pdfUrl || g.metadata?.pdfUrl || '';

    if (isRealPublicPdfUrl(candidateUrl) && pdfUrlColIndex !== -1) {
      const cellAddress = XLSX.utils.encode_cell({ r: sheetRowNumber - 1, c: pdfUrlColIndex });
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].l = {
          Target: candidateUrl,
          Tooltip: `Click to view ${g.pdfFilename} online`,
        };
      }
    }
  });

  // Auto-fit column widths tailored to the 5 columns
  worksheet['!cols'] = [
    { wch: 38 }, // Title
    { wch: 16 }, // Image URL
    { wch: 48 }, // PDF URL
    { wch: 42 }, // SEO
    { wch: 65 }, // SEO Description
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ebook_Metadata');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

