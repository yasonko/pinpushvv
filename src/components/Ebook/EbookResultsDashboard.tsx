import React, { useState } from 'react';
import { EbookBatch, EbookGroup } from '../../types/ebook';
import { Board, Website, Pin } from '../../types';
import { 
  CheckCircle2, 
  Download, 
  FileSpreadsheet, 
  FolderArchive, 
  FileText, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink,
  Layers,
  ArrowRight,
  RotateCcw,
  Share2,
  Globe,
  CloudUpload,
  AlertCircle,
  Link
} from 'lucide-react';
import { triggerBlobDownload } from '../../services/ebook/ebookZipService';
import { formatBytes } from '../../services/ebook/excelGenerator';
import { uploadPdfWithRetry, getSavedStorageConfig, isRealPublicPdfUrl } from '../../services/ebook/pdfStorageService';

interface EbookResultsDashboardProps {
  batch: EbookBatch;
  boards: Board[];
  websites: Website[];
  onRetryFailed?: () => void;
  onRetryUploads?: () => void;
  onExportToPins?: (pins: Partial<Pin>[]) => void;
  onNewBatch?: () => void;
  onGroupUpdated?: (updatedGroup: EbookGroup) => void;
}

export const EbookResultsDashboard: React.FC<EbookResultsDashboardProps> = ({
  batch,
  boards,
  websites,
  onRetryFailed,
  onRetryUploads,
  onExportToPins,
  onNewBatch,
  onGroupUpdated,
}) => {
  const [copiedGroupIndex, setCopiedGroupIndex] = useState<number | null>(null);
  const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);
  const [copiedAllUrls, setCopiedAllUrls] = useState<boolean>(false);
  const [exportedToPinsSuccess, setExportedToPinsSuccess] = useState<boolean>(false);
  const [retryingUploadId, setRetryingUploadId] = useState<string | null>(null);

  const completedGroups = batch.groups.filter((g) => g.status === 'completed' && g.pdfBlob);
  const uploadedGroups = batch.groups.filter((g) => g.uploadStatus === 'completed' && g.pdfUrl);
  const failedUploadGroups = batch.groups.filter((g) => g.uploadStatus === 'upload_failed' || (!g.pdfUrl && g.pdfBlob));
  const failedGroups = batch.groups.filter((g) => g.status === 'failed');

  const totalBytes = batch.groups.reduce((acc, g) => acc + (g.pdfFileSizeBytes || 0), 0);

  const handleDownloadZip = () => {
    if (batch.zipBlob && batch.zipFilename) {
      triggerBlobDownload(batch.zipBlob, batch.zipFilename);
    }
  };

  const handleDownloadExcel = () => {
    if (batch.excelBlob) {
      const name = batch.excelFilename || `Ebook_Metadata_${batch.settings.namingPrefix || 'Collection'}.xlsx`;
      triggerBlobDownload(batch.excelBlob, name);
    }
  };

  const handleDownloadSinglePdf = (group: EbookGroup) => {
    if (group.pdfBlob) {
      triggerBlobDownload(group.pdfBlob, group.pdfFilename);
    }
  };

  const handleCopySingleUrl = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedUrlIndex(index);
    setTimeout(() => setCopiedUrlIndex(null), 2000);
  };

  const handleCopyAllUrls = () => {
    const allUrls = batch.groups
      .filter((g) => g.pdfUrl)
      .map((g) => `${g.pdfFilename}: ${g.pdfUrl}`)
      .join('\n');

    if (!allUrls) return;
    navigator.clipboard.writeText(allUrls);
    setCopiedAllUrls(true);
    setTimeout(() => setCopiedAllUrls(false), 2500);
  };

  const handleRetrySingleUpload = async (group: EbookGroup) => {
    if (!group.pdfBlob) return;
    setRetryingUploadId(group.id);
    try {
      const config = batch.settings.storageConfig || getSavedStorageConfig();
      const res = await uploadPdfWithRetry(group.pdfBlob, group.pdfFilename, config, 3);
      const updated: EbookGroup = {
        ...group,
        pdfUrl: res.publicUrl,
        uploadStatus: 'completed',
        storageProvider: res.provider,
        remotePath: res.remotePath,
        uploadedAt: res.uploadedAt,
        uploadError: null,
      };
      if (updated.metadata) {
        updated.metadata.pdfUrl = res.publicUrl;
        updated.metadata.uploadStatus = 'completed';
        updated.metadata.storageProvider = res.provider;
      }
      if (onGroupUpdated) {
        onGroupUpdated(updated);
      }
    } catch (err: any) {
      console.error('Failed retry upload:', err);
    } finally {
      setRetryingUploadId(null);
    }
  };

  const handleCopyMetadata = (group: EbookGroup, index: number) => {
    if (!group.metadata) return;
    const text = `Ebook Title: ${group.metadata.ebookTitle}
Subtitle: ${group.metadata.subtitle}
Category: ${group.metadata.category}
Short Description: ${group.metadata.shortDescription}
Long Description: ${group.metadata.longDescription}
Main Topic: ${group.metadata.mainTopic}
Audience: ${group.metadata.audience}
Public PDF URL: ${group.pdfUrl || group.metadata.pdfUrl || 'N/A'}
SEO Keywords: ${group.metadata.seoKeywords?.join(', ')}
Pinterest Keywords: ${group.metadata.pinterestKeywords?.join(', ')}
Pinterest Title: ${group.metadata.pinterestTitle}
Pinterest Description: ${group.metadata.pinterestDescription}`;

    navigator.clipboard.writeText(text);
    setCopiedGroupIndex(index);
    setTimeout(() => setCopiedGroupIndex(null), 2000);
  };

  const handleConvertBatchToPins = () => {
    if (!onExportToPins) return;
    const newPins: Partial<Pin>[] = [];

    batch.groups.forEach((g) => {
      if (!g.metadata) return;
      const firstImg = g.imageItems[0];
      const imageUrl = g.coverDataUrl || firstImg?.previewUrl || firstImg?.dataUrl || '';
      const realPublicPdf = isRealPublicPdfUrl(g.pdfUrl) ? g.pdfUrl : '';
      const targetDestinationUrl = realPublicPdf || g.destinationUrl || '';

      newPins.push({
        id: `pin_ebook_${Date.now()}_${g.pdfNumberFormatted}`,
        filename: g.pdfFilename,
        imageUrl: imageUrl,
        thumbnailUrl: imageUrl,
        title: g.metadata.pinterestTitle || g.metadata.ebookTitle,
        description: g.metadata.pinterestDescription || g.metadata.shortDescription,
        altText: `Cover and preview for ${g.metadata.ebookTitle} printable eBook PDF`,
        tags: g.metadata.pinterestKeywords || [],
        destinationUrl: targetDestinationUrl,
        boardId: g.boardId || batch.settings.defaultBoardId,
        status: 'ready',
        aiStatus: 'completed',
        aiGenerated: true,
        titleManuallyEdited: false,
        descriptionManuallyEdited: false,
        tagsManuallyEdited: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: null,
        publishedAt: null,
      });
    });

    onExportToPins(newPins);
    setExportedToPinsSuccess(true);
    setTimeout(() => setExportedToPinsSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>Bulk eBook Batch Complete!</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold px-2.5 py-1 rounded-full">
                {uploadedGroups.length}/{completedGroups.length} Uploaded to Cloud
              </span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Successfully generated <strong className="text-emerald-700 dark:text-emerald-400">{completedGroups.length} PDF eBooks</strong> with live public URLs, Excel spreadsheet, and complete ZIP package.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {batch.zipBlob && (
            <button
              onClick={handleDownloadZip}
              className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all"
            >
              <FolderArchive className="w-4 h-4" />
              <span>Download ZIP Package ({formatBytes(batch.zipBlob.size)})</span>
            </button>
          )}

          {batch.excelBlob && (
            <button
              onClick={handleDownloadExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel (with Live URLs)</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total eBooks Created</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {completedGroups.length} <span className="text-sm font-normal text-slate-400">/ {batch.totalPdfs}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Public Hosted URLs</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1.5">
            <span>{uploadedGroups.length}</span>
            <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">
              HTTPS Live
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total PDF Payload</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatBytes(totalBytes)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Metadata Spreadsheet</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            5 Columns <span className="text-sm font-normal text-slate-400">clean format</span>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Cloud Hosting & Fast Actions
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {uploadedGroups.length > 0 && (
            <button
              onClick={handleCopyAllUrls}
              className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copiedAllUrls ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAllUrls ? 'All URLs Copied!' : `Copy All ${uploadedGroups.length} Public URLs`}</span>
            </button>
          )}

          {failedUploadGroups.length > 0 && onRetryUploads && (
            <button
              onClick={onRetryUploads}
              className="px-3.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry {failedUploadGroups.length} Cloud Uploads</span>
            </button>
          )}

          {onExportToPins && (
            <button
              onClick={handleConvertBatchToPins}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                exportedToPinsSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800'
              }`}
            >
              {exportedToPinsSuccess ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{exportedToPinsSuccess ? 'Added to Pin Library!' : 'Export eBooks to Pin Library'}</span>
            </button>
          )}

          {failedGroups.length > 0 && onRetryFailed && (
            <button
              onClick={onRetryFailed}
              className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry {failedGroups.length} Failed eBooks</span>
            </button>
          )}

          {onNewBatch && (
            <button
              onClick={onNewBatch}
              className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Start New Batch
            </button>
          )}
        </div>
      </div>

      {/* Generated Ebooks List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
            Generated PDF eBooks & Cloud Public URLs ({batch.groups.length})
          </h4>
          <span className="text-xs text-slate-400">All URLs are public, permanent HTTPS links</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {batch.groups.map((group, gIdx) => {
            const isCopiedMeta = copiedGroupIndex === gIdx;
            const isCopiedUrl = copiedUrlIndex === gIdx;

            return (
              <div key={group.id} className="p-4.5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {group.coverDataUrl ? (
                    <img
                      src={group.coverDataUrl}
                      alt="Cover"
                      className="w-14 h-18 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-18 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-lg border border-indigo-100 dark:border-indigo-900 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {group.metadata?.ebookTitle || group.pdfFilename}
                      </span>
                      <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold px-2 py-0.5 rounded">
                        #{group.pdfNumberFormatted}
                      </span>
                      {group.uploadStatus === 'completed' && group.pdfUrl ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Uploaded ({group.storageProvider || 'Cloud'})</span>
                        </span>
                      ) : group.uploadStatus === 'upload_failed' ? (
                        <span className="text-[10px] bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full font-medium">
                          Upload Failed
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                      {group.metadata?.subtitle || `${group.imageCount} Pages (Pages ${group.startIndex}-${group.endIndex})`}
                    </p>

                    {/* Real Public PDF URL Box */}
                    {group.pdfUrl ? (
                      <div className="flex items-center gap-2 max-w-xl">
                        <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 font-mono truncate">
                          <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mr-1.5" />
                          <span className="truncate">{group.pdfUrl}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopySingleUrl(group.pdfUrl!, gIdx)}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1 transition-colors"
                          title="Copy Public URL"
                        >
                          {isCopiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={group.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-xs flex items-center gap-1 transition-colors"
                          title="Open PDF online"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Public URL pending or failed to upload.</span>
                        {group.pdfBlob && (
                          <button
                            type="button"
                            onClick={() => handleRetrySingleUpload(group)}
                            disabled={retryingUploadId === group.id}
                            className="underline font-semibold hover:text-amber-700 ml-1"
                          >
                            {retryingUploadId === group.id ? 'Uploading...' : 'Upload Now'}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-slate-400">
                      <span>{group.pdfFilename}</span>
                      <span>•</span>
                      <span>{group.imageCount} pages</span>
                      {group.pdfFileSizeBytes ? (
                        <>
                          <span>•</span>
                          <span>{formatBytes(group.pdfFileSizeBytes)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center">
                  <button
                    onClick={() => handleCopyMetadata(group, gIdx)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                    title="Copy AI Metadata"
                  >
                    {isCopiedMeta ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{isCopiedMeta ? 'Copied' : 'Metadata'}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadSinglePdf(group)}
                    disabled={!group.pdfBlob}
                    className="px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

