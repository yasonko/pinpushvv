import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is configured for Vite environment
try {
  if (typeof window !== 'undefined') {
    // In Vite, new URL with import.meta.url creates an asset URL
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
} catch (err) {
  console.warn('Fallback to CDN worker for PDF.js:', err);
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
}

export interface ExtractedPdfPage {
  pageNumber: number;
  dataUrl: string;
  thumbnailUrl: string;
  file: File;
  filename: string;
  title: string;
  width: number;
  height: number;
}

export interface PdfImportOptions {
  scale?: number;
  quality?: number;
  maxPages?: number;
  onProgress?: (current: number, total: number, message: string) => void;
}

/**
 * Extracts all pages of a PDF as high-resolution images
 */
export async function extractPagesFromPdf(
  file: File,
  options: PdfImportOptions = {}
): Promise<ExtractedPdfPage[]> {
  const { scale = 1.6, quality = 0.88, maxPages = 150, onProgress } = options;

  onProgress?.(0, 1, 'Loading PDF document...');
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = Math.min(pdf.numPages, maxPages);
  const baseName = file.name.replace(/\.[^/.]+$/, '').trim();

  const extractedPages: ExtractedPdfPage[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages, `Rendering page ${pageNum} of ${totalPages}...`);
    
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error(`Failed to get canvas 2D context for page ${pageNum}`);
    }

    // Fill white background for clean rendering
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      canvas,
      viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);

    // Create a compact thumbnail
    const thumbCanvas = document.createElement('canvas');
    const thumbScale = Math.min(1, 360 / canvas.width);
    thumbCanvas.width = Math.max(100, Math.floor(canvas.width * thumbScale));
    thumbCanvas.height = Math.max(100, Math.floor(canvas.height * thumbScale));
    const thumbCtx = thumbCanvas.getContext('2d');
    if (thumbCtx) {
      thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    }
    const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.75);

    // Convert dataUrl to File
    const byteString = atob(dataUrl.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'image/jpeg' });
    
    const formattedPageNum = String(pageNum).padStart(2, '0');
    const filename = `${baseName}_Page_${formattedPageNum}.jpg`;
    const cleanTitle = `${baseName.replace(/[-_]/g, ' ')} - Page ${pageNum}`;
    const pageFile = new File([blob], filename, { type: 'image/jpeg' });

    extractedPages.push({
      pageNumber: pageNum,
      dataUrl,
      thumbnailUrl,
      file: pageFile,
      filename,
      title: cleanTitle,
      width: canvas.width,
      height: canvas.height,
    });
  }

  onProgress?.(totalPages, totalPages, `Finished importing ${totalPages} pages.`);
  return extractedPages;
}
