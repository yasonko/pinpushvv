import {
  EbookBatch,
  EbookGroup,
  EbookImageItem,
  EbookProgressState,
  PdfSettings,
} from '../../types/ebook';
import { Board, Website } from '../../types';
import { generateGroupMetadata } from './ebookAiService';
import { generateGroupPdf } from './pdfGenerator';
import { generateEbookExcelWorkbook } from './excelGenerator';
import { packageEbookBatchZip } from './ebookZipService';
import { computeBatchHash, saveEbookBatch } from './ebookBatchStorage';
import { uploadPdfWithRetry, getSavedStorageConfig } from './pdfStorageService';

/**
 * Deterministically partitions an array of images into zero-padded eBook groups
 */
export function groupImagesDeterministically(
  images: EbookImageItem[],
  settings: PdfSettings
): EbookGroup[] {
  const perPdf = Math.max(1, settings.imagesPerPdf || 20);
  const startNum = Math.max(1, settings.startNumber || 1);
  const cleanPrefix = (settings.namingPrefix || 'eBook')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const groups: EbookGroup[] = [];
  const totalGroups = Math.ceil(images.length / perPdf);

  // Determine padding length (at least 3 digits: 001, 002)
  const padLength = Math.max(3, String(startNum + totalGroups).length);

  for (let gIdx = 0; gIdx < totalGroups; gIdx++) {
    const startSlice = gIdx * perPdf;
    const endSlice = Math.min(startSlice + perPdf, images.length);
    const groupItems = images.slice(startSlice, endSlice);

    const currentPdfNumber = startNum + gIdx;
    const pdfNumberFormatted = String(currentPdfNumber).padStart(padLength, '0');
    const pdfFilename = `${cleanPrefix}_${pdfNumberFormatted}.pdf`;

    groups.push({
      id: `group_${gIdx}_${pdfNumberFormatted}`,
      groupIndex: gIdx,
      pdfNumberFormatted,
      pdfFilename,
      imageItems: groupItems,
      startIndex: startSlice + 1,
      endIndex: endSlice,
      imageCount: groupItems.length,
      status: 'pending',
      uploadStatus: 'pending',
      pdfUrl: '',
      boardId: settings.defaultBoardId,
    });
  }

  return groups;
}

export interface BatchProcessingCallbacks {
  onProgress?: (progress: EbookProgressState) => void;
  onGroupCompleted?: (group: EbookGroup, index: number, total: number) => void;
  onGroupFailed?: (group: EbookGroup, error: string) => void;
}

/**
 * Main Bulk Engine: Processes all groups sequentially with non-blocking pauses
 * Workflow: Images -> Group -> AI Metadata -> Generate PDF -> Upload PDF -> Receive Public URL -> Excel -> ZIP
 */
export async function executeEbookBatch(
  batch: EbookBatch,
  boards: Board[] = [],
  websites: Website[] = [],
  callbacks: BatchProcessingCallbacks = {},
  forceRegenerate: boolean = false,
  shouldAbort?: () => boolean
): Promise<EbookBatch> {
  const currentBatch: EbookBatch = {
    ...batch,
    status: 'processing',
    updatedAt: new Date().toISOString(),
  };

  const storageConfig = currentBatch.settings.storageConfig || getSavedStorageConfig();
  currentBatch.settings.storageConfig = storageConfig;

  const totalGroups = currentBatch.groups.length;
  const totalImages = currentBatch.images.length;
  const startTime = Date.now();

  const updateProgress = (
    stage: EbookProgressState['currentStage'],
    gIdx: number,
    imgIdx: number,
    detailMessage: string,
    uploadIdx?: number
  ) => {
    if (callbacks.onProgress) {
      const completedCount = currentBatch.groups.filter((g) => g.status === 'completed').length;
      const uploadedCount = currentBatch.groups.filter((g) => g.uploadStatus === 'completed').length;
      const groupProgressWeight = totalGroups > 0 ? (completedCount / totalGroups) * 75 : 0;
      const stageWeight =
        stage === 'ai_metadata'
          ? 5
          : stage === 'pdf_rendering'
          ? 10
          : stage === 'uploading_pdf'
          ? 70
          : stage === 'excel_export'
          ? 85
          : stage === 'zip_packaging'
          ? 92
          : stage === 'finished'
          ? 100
          : 0;

      const percentage = Math.min(100, Math.max(0, Math.round(Math.max(groupProgressWeight, stageWeight))));

      callbacks.onProgress({
        currentStage: stage,
        currentGroupIndex: gIdx + 1,
        totalGroups,
        currentImageIndex: imgIdx,
        totalImages,
        percentage,
        detailMessage,
        currentUploadIndex: uploadIdx || (uploadedCount + 1),
        totalUploads: totalGroups,
        completedUploads: uploadedCount,
        failedUploads: currentBatch.groups.filter((g) => g.uploadStatus === 'upload_failed').length,
        startTime,
      });
    }
  };

  // 1. Process each group sequentially
  for (let i = 0; i < currentBatch.groups.length; i++) {
    if (shouldAbort && shouldAbort()) {
      currentBatch.status = 'paused';
      break;
    }

    const group = currentBatch.groups[i];

    // If already fully generated AND uploaded and not force regenerating, skip!
    if (!forceRegenerate && group.status === 'completed' && group.pdfBlob && group.uploadStatus === 'completed' && group.pdfUrl) {
      continue;
    }

    currentBatch.currentProcessingGroupIndex = i;

    try {
      // Step A: Generate AI Metadata if not present
      if (!group.metadata || forceRegenerate) {
        group.status = 'analyzing_ai';
        group.statusMessage = 'Generating AI Metadata & SEO Keywords...';
        updateProgress('ai_metadata', i, group.startIndex, `Analyzing content & AI metadata for ${group.pdfFilename}...`);

        const metadata = await generateGroupMetadata(group, currentBatch.settings);
        group.metadata = metadata;
      }

      // Yield CPU to maintain UI responsiveness
      await new Promise((r) => setTimeout(r, 60));

      if (shouldAbort && shouldAbort()) {
        currentBatch.status = 'paused';
        break;
      }

      // Step B: Generate PDF if not yet rendered
      let generatedBlob = group.pdfBlob;
      if (!generatedBlob || forceRegenerate) {
        group.status = 'generating_pdf';
        group.statusMessage = 'Rendering high-resolution PDF pages...';
        updateProgress('pdf_rendering', i, group.startIndex, `Rendering ${group.pdfFilename} (${group.imageCount} pages)...`);

        const { pdfBlob, fileSizeBytes, coverDataUrl } = await generateGroupPdf(
          group,
          currentBatch.settings,
          (currPage, totalPage) => {
            updateProgress(
              'pdf_rendering',
              i,
              group.startIndex + currPage - 1,
              `Rendering page ${currPage}/${totalPage} of ${group.pdfFilename}...`
            );
          }
        );

        generatedBlob = pdfBlob;
        group.pdfBlob = pdfBlob;
        group.pdfFileSizeBytes = fileSizeBytes;
        group.coverDataUrl = coverDataUrl;
      }

      // Step C: Public Cloud Storage Upload (with auto-retries)
      const shouldUpload = currentBatch.settings.autoUploadPdf !== false;
      if (shouldUpload && generatedBlob && (group.uploadStatus !== 'completed' || !group.pdfUrl || forceRegenerate)) {
        group.status = 'uploading';
        group.uploadStatus = 'uploading';
        group.statusMessage = `Uploading PDF to ${storageConfig.provider || 'cloud storage'}...`;
        updateProgress(
          'uploading_pdf',
          i,
          group.startIndex,
          `Uploading ${group.pdfFilename} to cloud storage (eBook ${i + 1}/${totalGroups})...`,
          i + 1
        );

        try {
          const uploadResult = await uploadPdfWithRetry(generatedBlob, group.pdfFilename, storageConfig, 3);
          group.pdfUrl = uploadResult.publicUrl;
          group.uploadStatus = 'completed';
          group.storageProvider = uploadResult.provider;
          group.remotePath = uploadResult.remotePath;
          group.uploadedAt = uploadResult.uploadedAt;
          group.uploadAttempts = 1;
          group.uploadError = null;

          // Sync into metadata
          if (group.metadata) {
            group.metadata.pdfUrl = uploadResult.publicUrl;
            group.metadata.uploadStatus = 'completed';
            group.metadata.uploadedAt = uploadResult.uploadedAt;
            group.metadata.storageProvider = uploadResult.provider;
            group.metadata.fileSize = group.pdfFileSizeBytes;
          }
          console.log(`[Bulk Engine] Successfully uploaded ${group.pdfFilename} -> ${uploadResult.publicUrl}`);
        } catch (uploadErr: any) {
          console.error(`[Bulk Engine] PDF upload failed for ${group.pdfFilename}:`, uploadErr);
          group.uploadStatus = 'upload_failed';
          group.uploadError = uploadErr.message || 'Upload failed';
          group.uploadAttempts = (group.uploadAttempts || 0) + 1;
        }
      }

      group.status = 'completed';
      group.statusMessage = group.uploadStatus === 'completed' ? 'PDF Generated & Uploaded to Cloud' : 'PDF Generated (Local)';
      group.completedAt = new Date().toISOString();
      group.error = null;

      currentBatch.completedPdfs = currentBatch.groups.filter((g) => g.status === 'completed').length;
      currentBatch.uploadedPdfs = currentBatch.groups.filter((g) => g.uploadStatus === 'completed').length;
      currentBatch.failedUploads = currentBatch.groups.filter((g) => g.uploadStatus === 'upload_failed').length;

      if (callbacks.onGroupCompleted) {
        callbacks.onGroupCompleted(group, i + 1, totalGroups);
      }

      // Checkpoint state into IndexedDB
      saveEbookBatch(currentBatch);
    } catch (groupErr: any) {
      console.error(`[Bulk Engine] Failed processing ${group.pdfFilename}:`, groupErr);
      group.status = 'failed';
      group.statusMessage = `Error: ${groupErr.message || 'Generation failed'}`;
      group.error = groupErr.message || 'Generation failed';
      currentBatch.failedPdfs = currentBatch.groups.filter((g) => g.status === 'failed').length;

      if (callbacks.onGroupFailed) {
        callbacks.onGroupFailed(group, group.error || 'Failed');
      }
    }

    // Small delay between PDFs to keep browser thread cool
    await new Promise((r) => setTimeout(r, 80));
  }

  // 2. Generate Final Excel Spreadsheet (With real clickable PDF URLs)
  updateProgress('excel_export', totalGroups, totalImages, 'Generating Excel Metadata spreadsheet (XLSX)...');
  try {
    const excelBlob = generateEbookExcelWorkbook(currentBatch.groups, currentBatch.settings, boards, websites);
    currentBatch.excelBlob = excelBlob;
    currentBatch.excelFilename = `Ebook_Metadata_${currentBatch.settings.namingPrefix || 'Collection'}.xlsx`;
  } catch (excelErr: any) {
    console.warn('[Bulk Engine] Failed generating Excel workbook:', excelErr);
  }

  // 3. Package ZIP Archive if there are completed PDFs
  const completedList = currentBatch.groups.filter((g) => g.status === 'completed' && g.pdfBlob);
  if (completedList.length > 0) {
    updateProgress('zip_packaging', totalGroups, totalImages, 'Packaging PDFs & Excel into ZIP archive...');
    try {
      const zipRes = await packageEbookBatchZip(
        currentBatch.groups,
        currentBatch.settings,
        boards,
        websites,
        (_pct, currentFile) => {
          updateProgress('zip_packaging', totalGroups, totalImages, currentFile);
        }
      );
      currentBatch.zipBlob = zipRes.zipBlob;
      currentBatch.zipFilename = zipRes.filename;
    } catch (zipErr: any) {
      console.warn('[Bulk Engine] Failed packaging ZIP:', zipErr);
    }
  }

  currentBatch.completedPdfs = currentBatch.groups.filter((g) => g.status === 'completed').length;
  currentBatch.uploadedPdfs = currentBatch.groups.filter((g) => g.uploadStatus === 'completed').length;
  currentBatch.failedUploads = currentBatch.groups.filter((g) => g.uploadStatus === 'upload_failed').length;
  currentBatch.status = currentBatch.failedPdfs === totalGroups ? 'failed' : 'completed';
  currentBatch.updatedAt = new Date().toISOString();
  updateProgress('finished', totalGroups, totalImages, 'All eBooks generated and uploaded with public URLs!');

  // Save final state
  saveEbookBatch(currentBatch);

  return currentBatch;
}

/**
 * Retries failed PDF uploads without re-generating existing PDF pages
 */
export async function retryFailedUploadsOnly(
  batch: EbookBatch,
  boards: Board[] = [],
  websites: Website[] = [],
  callbacks: BatchProcessingCallbacks = {}
): Promise<EbookBatch> {
  const currentBatch: EbookBatch = {
    ...batch,
    status: 'processing',
    updatedAt: new Date().toISOString(),
  };

  const storageConfig = currentBatch.settings.storageConfig || getSavedStorageConfig();
  const failedGroups = currentBatch.groups.filter((g) => g.uploadStatus === 'upload_failed' || (!g.pdfUrl && g.pdfBlob));

  for (let i = 0; i < failedGroups.length; i++) {
    const group = failedGroups[i];
    if (!group.pdfBlob) continue;

    group.status = 'uploading';
    group.uploadStatus = 'uploading';
    group.statusMessage = `Retrying upload to ${storageConfig.provider}...`;

    if (callbacks.onProgress) {
      callbacks.onProgress({
        currentStage: 'uploading_pdf',
        currentGroupIndex: i + 1,
        totalGroups: failedGroups.length,
        currentImageIndex: 0,
        totalImages: currentBatch.images.length,
        percentage: Math.round(((i + 1) / failedGroups.length) * 100),
        detailMessage: `Retrying upload for ${group.pdfFilename} (${i + 1}/${failedGroups.length})...`,
      });
    }

    try {
      const uploadResult = await uploadPdfWithRetry(group.pdfBlob, group.pdfFilename, storageConfig, 3);
      group.pdfUrl = uploadResult.publicUrl;
      group.uploadStatus = 'completed';
      group.storageProvider = uploadResult.provider;
      group.remotePath = uploadResult.remotePath;
      group.uploadedAt = uploadResult.uploadedAt;
      group.uploadError = null;
      group.status = 'completed';
      group.statusMessage = 'PDF Generated & Uploaded to Cloud';

      if (group.metadata) {
        group.metadata.pdfUrl = uploadResult.publicUrl;
        group.metadata.uploadStatus = 'completed';
        group.metadata.uploadedAt = uploadResult.uploadedAt;
        group.metadata.storageProvider = uploadResult.provider;
      }
    } catch (err: any) {
      group.uploadStatus = 'upload_failed';
      group.uploadError = err.message || 'Retry failed';
      group.status = 'failed';
    }
  }

  // Re-generate Excel with updated URLs
  try {
    currentBatch.excelBlob = generateEbookExcelWorkbook(currentBatch.groups, currentBatch.settings, boards, websites);
  } catch (e) {
    console.warn('Excel regeneration error:', e);
  }

  // Re-generate ZIP
  try {
    const zipRes = await packageEbookBatchZip(currentBatch.groups, currentBatch.settings, boards, websites);
    currentBatch.zipBlob = zipRes.zipBlob;
  } catch (e) {
    console.warn('ZIP regeneration error:', e);
  }

  currentBatch.completedPdfs = currentBatch.groups.filter((g) => g.status === 'completed').length;
  currentBatch.uploadedPdfs = currentBatch.groups.filter((g) => g.uploadStatus === 'completed').length;
  currentBatch.failedUploads = currentBatch.groups.filter((g) => g.uploadStatus === 'upload_failed').length;
  currentBatch.status = 'completed';
  currentBatch.updatedAt = new Date().toISOString();

  saveEbookBatch(currentBatch);
  return currentBatch;
}

