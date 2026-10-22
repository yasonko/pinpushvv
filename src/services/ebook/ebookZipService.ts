import JSZip from 'jszip';
import { EbookGroup, PdfSettings } from '../../types/ebook';
import { Board, Website } from '../../types';
import { generateEbookExcelWorkbook } from './excelGenerator';

export interface ZipPackageResult {
  zipBlob: Blob;
  filename: string;
  totalPdfsIncluded: number;
  totalSize: number;
}

/**
 * Packages all completed PDF files and the Excel spreadsheet into a single ZIP archive.
 */
export async function packageEbookBatchZip(
  groups: EbookGroup[],
  settings: PdfSettings,
  boards: Board[] = [],
  websites: Website[] = [],
  onProgress?: (percent: number, currentFile: string) => void
): Promise<ZipPackageResult> {
  const zip = new JSZip();

  const completedGroups = groups.filter((g) => g.status === 'completed' && g.pdfBlob);
  if (completedGroups.length === 0) {
    throw new Error('No completed PDFs available to package into ZIP');
  }

  // 1. Determine folder structure
  const pdfFolder = settings.pdfFolderInZip ? zip.folder('PDFs') : zip;

  // 2. Add each PDF
  for (let i = 0; i < completedGroups.length; i++) {
    const group = completedGroups[i];
    if (onProgress) {
      const pct = Math.round((i / (completedGroups.length + 1)) * 50);
      onProgress(pct, `Adding ${group.pdfFilename}...`);
    }

    if (group.pdfBlob && pdfFolder) {
      pdfFolder.file(group.pdfFilename, group.pdfBlob);
    }
  }

  // 3. Generate & Add Excel Spreadsheet
  if (onProgress) {
    onProgress(60, 'Generating Ebook_Metadata.xlsx...');
  }
  const excelBlob = generateEbookExcelWorkbook(groups, settings, boards, websites);
  zip.file('Ebook_Metadata.xlsx', excelBlob);

  // 4. Compress Archive
  const cleanPrefix = (settings.namingPrefix || 'Ebooks_Collection')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  const zipFilename = `${cleanPrefix}_${timestamp}.zip`;

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        const pct = 60 + Math.round((metadata.percent / 100) * 40);
        onProgress(pct, metadata.currentFile ? `Compressing ${metadata.currentFile}...` : 'Compressing ZIP archive...');
      }
    }
  );

  return {
    zipBlob,
    filename: zipFilename,
    totalPdfsIncluded: completedGroups.length,
    totalSize: zipBlob.size,
  };
}

/**
 * Triggers browser download for a Blob
 */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}
