import { jsPDF } from 'jspdf';
import { PdfSettings, EbookGroup, EbookImageItem } from '../../types/ebook';
import { generateEbookCoverCanvas } from './coverGenerator';

/**
 * Dimensions mapping in Millimeters
 */
const PAGE_DIMENSIONS_MM = {
  A4: { width: 210, height: 297 },
  LETTER: { width: 215.9, height: 279.4 },
  SQUARE: { width: 210, height: 210 },
};

const MARGIN_SIZES_MM = {
  none: 0,
  small: 6,
  medium: 14,
};

/**
 * Loads an image into an HTMLImageElement to get exact natural dimensions and data URI
 */
function loadImageData(urlOrDataUri: string): Promise<{ img: HTMLImageElement; dataUri: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // If it's already data URI, return directly
      if (urlOrDataUri.startsWith('data:')) {
        resolve({ img, dataUri: urlOrDataUri });
        return;
      }
      // Otherwise convert to canvas data URI
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const data = canvas.toDataURL('image/jpeg', 0.95);
          resolve({ img, dataUri: data });
        } else {
          resolve({ img, dataUri: urlOrDataUri });
        }
      } catch {
        resolve({ img, dataUri: urlOrDataUri });
      }
    };
    img.onerror = (e) => reject(new Error(`Failed to load image for PDF: ${urlOrDataUri.slice(0, 60)}`));
    img.src = urlOrDataUri;
  });
}

/**
 * Generates a complete PDF document for an eBook group using jsPDF.
 */
export async function generateGroupPdf(
  group: EbookGroup,
  settings: PdfSettings,
  onPageProgress?: (current: number, total: number) => void
): Promise<{ pdfBlob: Blob; fileSizeBytes: number; coverDataUrl?: string }> {
  const pageSize = settings.pageSize || 'A4';
  let baseDims = PAGE_DIMENSIONS_MM[pageSize as keyof typeof PAGE_DIMENSIONS_MM] || PAGE_DIMENSIONS_MM.A4;

  if (pageSize === 'CUSTOM' && settings.customWidthMm && settings.customHeightMm) {
    baseDims = { width: settings.customWidthMm, height: settings.customHeightMm };
  }

  const orientation = settings.orientation || 'portrait';
  let pageWidth = baseDims.width;
  let pageHeight = baseDims.height;

  if (orientation === 'landscape') {
    pageWidth = Math.max(baseDims.width, baseDims.height);
    pageHeight = Math.min(baseDims.width, baseDims.height);
  } else if (orientation === 'portrait') {
    pageWidth = Math.min(baseDims.width, baseDims.height);
    pageHeight = Math.max(baseDims.width, baseDims.height);
  }

  const doc = new jsPDF({
    orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
    compress: settings.quality !== 'high',
  });

  const marginMm = MARGIN_SIZES_MM[settings.margins || 'small'];
  const printableWidth = pageWidth - marginMm * 2;
  const printableHeight = pageHeight - marginMm * 2;

  let coverDataUrl: string | undefined = undefined;
  let pageCounter = 0;
  const totalContentPages = group.imageItems.length;

  // 1. Generate & Insert Cover Page if enabled
  if (settings.generateCover && settings.coverTheme !== 'none') {
    try {
      const coverTitle = group.metadata?.ebookTitle || `eBook Collection #${group.pdfNumberFormatted}`;
      const coverSubtitle = group.metadata?.subtitle || `${totalContentPages} Curated Premium Pages`;
      const sampleItem = group.imageItems[0];

      coverDataUrl = await generateEbookCoverCanvas({
        title: coverTitle,
        subtitle: coverSubtitle,
        author: settings.authorName,
        theme: settings.coverTheme || 'modern',
        sampleImage: sampleItem,
        width: 1240,
        height: Math.round(1240 * (pageHeight / pageWidth)),
      });

      if (coverDataUrl && settings.addCoverAsFirstPage) {
        doc.addImage(
          coverDataUrl,
          'JPEG',
          0,
          0,
          pageWidth,
          pageHeight,
          undefined,
          'FAST'
        );
        pageCounter++;
      }
    } catch (coverErr) {
      console.warn('[PDF Engine] Cover generation failed, proceeding without cover:', coverErr);
    }
  }

  // 2. Render each content image page
  for (let i = 0; i < group.imageItems.length; i++) {
    const item = group.imageItems[i];
    if (onPageProgress) {
      onPageProgress(i + 1, group.imageItems.length);
    }

    // Add page if not the very first page of an empty document
    if (pageCounter > 0) {
      doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait');
    }
    pageCounter++;

    const contentPageNumber = i + 1;

    try {
      const sourceUrl = item.dataUrl || item.previewUrl;
      const { img, dataUri } = await loadImageData(sourceUrl);

      const imgWidth = img.naturalWidth || img.width || 1000;
      const imgHeight = img.naturalHeight || img.height || 1000;
      const imgAspect = imgWidth / imgHeight;
      const printAspect = printableWidth / printableHeight;

      let drawW = printableWidth;
      let drawH = printableHeight;
      let drawX = marginMm;
      let drawY = marginMm;

      if (settings.imageFit === 'cover') {
        // Fill entire printable area
        drawW = printableWidth;
        drawH = printableHeight;
      } else {
        // Contain mode: Preserve aspect ratio centered inside printable box
        if (imgAspect > printAspect) {
          // Wider than printable area
          drawW = printableWidth;
          drawH = printableWidth / imgAspect;
          drawY = marginMm + (printableHeight - drawH) / 2;
        } else {
          // Taller than printable area
          drawH = printableHeight;
          drawW = printableHeight * imgAspect;
          drawX = marginMm + (printableWidth - drawW) / 2;
        }
      }

      // Add image to PDF
      doc.addImage(
        dataUri,
        dataUri.includes('png') ? 'PNG' : 'JPEG',
        drawX,
        drawY,
        drawW,
        drawH,
        undefined,
        settings.quality === 'high' ? 'NONE' : 'FAST'
      );

      // Add Page Number Footer if enabled
      if (settings.pageNumbers) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(140, 140, 140);
        const pageText = `${contentPageNumber} / ${totalContentPages}`;
        
        let footerX = pageWidth / 2;
        if (settings.pageNumberPosition === 'bottom-right') {
          footerX = pageWidth - marginMm - 5;
          doc.text(pageText, footerX, pageHeight - Math.max(3, marginMm / 2), { align: 'right' });
        } else if (settings.pageNumberPosition === 'bottom-left') {
          footerX = marginMm + 5;
          doc.text(pageText, footerX, pageHeight - Math.max(3, marginMm / 2), { align: 'left' });
        } else {
          doc.text(pageText, footerX, pageHeight - Math.max(3, marginMm / 2), { align: 'center' });
        }
      }
    } catch (pageErr: any) {
      console.warn(`[PDF Engine] Failed to add page ${i + 1} (${item.filename}):`, pageErr);
      // Draw placeholder page error box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(200, 50, 50);
      doc.text(`Error loading image: ${item.filename}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
    }
  }

  // 3. Render Back Cover if requested
  if (settings.generateBackCover) {
    doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait');
    doc.setFillColor(15, 23, 42); // Dark slate
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Thank You for Reading!', pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text(
      settings.authorName ? `Curated by ${settings.authorName}` : 'Explore more digital collections on our website',
      pageWidth / 2,
      pageHeight / 2 + 5,
      { align: 'center' }
    );
  }

  // Generate Blob
  const pdfBlob = doc.output('blob');
  const fileSizeBytes = pdfBlob.size;

  return {
    pdfBlob,
    fileSizeBytes,
    coverDataUrl,
  };
}
