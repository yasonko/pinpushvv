import React, { useState } from 'react';
import { EbookGroup, PdfSettings } from '../../types/ebook';
import { Board, Website } from '../../types';
import { 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Layers, 
  ExternalLink,
  Eye,
  AlertCircle,
  CloudUpload,
  Copy,
  Check,
  RotateCw,
  Globe,
  Palette,
  Ban,
  X,
  Maximize2
} from 'lucide-react';
import { formatBytes } from '../../services/ebook/excelGenerator';
import { uploadPdfWithRetry, getSavedStorageConfig } from '../../services/ebook/pdfStorageService';
import { generateEbookCoverCanvas, COVER_THEMES_CATALOG } from '../../services/ebook/coverGenerator';

interface EbookGroupAccordionProps {
  groups: EbookGroup[];
  settings: PdfSettings;
  boards: Board[];
  websites: Website[];
  onOpenPdf?: (group: EbookGroup) => void;
  onGroupUpdated?: (updatedGroup: EbookGroup) => void;
}

export const EbookGroupAccordion: React.FC<EbookGroupAccordionProps> = ({
  groups,
  settings,
  boards,
  websites,
  onOpenPdf,
  onGroupUpdated,
}) => {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(groups[0]?.id || null);
  const [copiedUrlGroup, setCopiedUrlGroup] = useState<string | null>(null);
  const [retryingGroupId, setRetryingGroupId] = useState<string | null>(null);

  // Group Cover Preview Modal State
  const [previewingCoverGroup, setPreviewingCoverGroup] = useState<EbookGroup | null>(null);
  const [previewCoverDataUrl, setPreviewCoverDataUrl] = useState<string | null>(null);
  const [isLoadingCover, setIsLoadingCover] = useState(false);

  const handleOpenCoverPreview = async (group: EbookGroup) => {
    setPreviewingCoverGroup(group);
    if (group.coverDataUrl) {
      setPreviewCoverDataUrl(group.coverDataUrl);
      return;
    }

    if (!settings.generateCover || settings.coverTheme === 'none') {
      setPreviewCoverDataUrl(null);
      return;
    }

    setIsLoadingCover(true);
    try {
      const coverTitle = group.metadata?.ebookTitle || (settings.namingPrefix ? `${settings.namingPrefix} Volume #${group.pdfNumberFormatted}` : `eBook Collection #${group.pdfNumberFormatted}`);
      const coverSubtitle = group.metadata?.subtitle || `${group.imageItems.length} Curated Pages`;
      const sampleItem = group.imageItems[0];

      const url = await generateEbookCoverCanvas({
        title: coverTitle,
        subtitle: coverSubtitle,
        author: settings.authorName,
        theme: settings.coverTheme || 'modern',
        sampleImage: sampleItem,
        width: 800,
        height: 1131,
      });
      setPreviewCoverDataUrl(url);
    } catch (err) {
      console.warn('Cover preview generation failed:', err);
      setPreviewCoverDataUrl(null);
    } finally {
      setIsLoadingCover(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedGroupId((prev) => (prev === id ? null : id));
  };

  const handleCopyUrl = (url: string, groupId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrlGroup(groupId);
    setTimeout(() => setCopiedUrlGroup(null), 2000);
  };

  const handleRetryUpload = async (group: EbookGroup) => {
    if (!group.pdfBlob) return;
    setRetryingGroupId(group.id);
    try {
      const config = settings.storageConfig || getSavedStorageConfig();
      const res = await uploadPdfWithRetry(group.pdfBlob, group.pdfFilename, config, 3);
      const updated: EbookGroup = {
        ...group,
        pdfUrl: res.publicUrl,
        uploadStatus: 'completed',
        storageProvider: res.provider,
        remotePath: res.remotePath,
        uploadedAt: res.uploadedAt,
        uploadError: null,
        statusMessage: 'PDF Generated & Uploaded to Cloud',
      };
      if (updated.metadata) {
        updated.metadata.pdfUrl = res.publicUrl;
        updated.metadata.uploadStatus = 'completed';
        updated.metadata.storageProvider = res.provider;
        updated.metadata.uploadedAt = res.uploadedAt;
      }
      if (onGroupUpdated) {
        onGroupUpdated(updated);
      }
    } catch (err: any) {
      console.error('Retry upload failed:', err);
      const updated: EbookGroup = {
        ...group,
        uploadStatus: 'upload_failed',
        uploadError: err.message || 'Upload failed',
      };
      if (onGroupUpdated) {
        onGroupUpdated(updated);
      }
    } finally {
      setRetryingGroupId(null);
    }
  };

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Deterministic PDF Grouping Preview ({groups.length} {groups.length === 1 ? 'eBook' : 'eBooks'})
          </h4>
        </div>
        <span className="text-xs text-slate-500">
          {settings.imagesPerPdf} pages target per PDF
        </span>
      </div>

      <div className="space-y-2.5">
        {groups.map((group) => {
          const isExpanded = expandedGroupId === group.id;

          return (
            <div
              key={group.id}
              className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all shadow-xs ${
                isExpanded
                  ? 'border-indigo-500/80 ring-1 ring-indigo-500/20'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Accordion Header */}
              <div
                onClick={() => toggleExpand(group.id)}
                className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/40 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {group.pdfFilename}
                      </span>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
                        #{group.pdfNumberFormatted}
                      </span>
                      {group.pdfUrl && (
                        <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          <span>Public URL Active</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>Pages {group.startIndex} – {group.endIndex}</span>
                      <span>•</span>
                      <span>{group.imageCount} {group.imageCount === 1 ? 'image' : 'images'}</span>
                      {group.pdfFileSizeBytes ? (
                        <>
                          <span>•</span>
                          <span>{formatBytes(group.pdfFileSizeBytes)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {group.uploadStatus === 'uploading' ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 animate-pulse flex items-center gap-1">
                      <CloudUpload className="w-3 h-3 animate-bounce" />
                      <span>Uploading PDF...</span>
                    </span>
                  ) : group.uploadStatus === 'upload_failed' ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Upload Failed</span>
                    </span>
                  ) : group.status === 'completed' ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                      ✓ Ready
                    </span>
                  ) : group.status === 'generating_pdf' ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse">
                      Rendering...
                    </span>
                  ) : group.status === 'analyzing_ai' ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 animate-pulse">
                      AI Metadata...
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                      Pending
                    </span>
                  )}

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Accordion Expanded Content */}
              {isExpanded && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900">
                  {/* Public PDF URL Box */}
                  {group.pdfUrl && (
                    <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          <Globe className="w-4 h-4 text-emerald-600" />
                          <span>Hosted Public PDF URL (HTTPS)</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md font-medium">
                          {group.storageProvider || 'Cloud Storage'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={group.pdfUrl}
                          className="flex-1 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-mono select-all focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(group.pdfUrl!, group.id)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1 transition-colors"
                          title="Copy Public URL"
                        >
                          {copiedUrlGroup === group.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <a
                          href={group.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors shadow-xs"
                          title="Open PDF online"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Upload Failed Box with Retry */}
                  {group.uploadStatus === 'upload_failed' && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-300">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <div className="font-semibold">Upload to public storage failed</div>
                          <div className="text-[11px] text-rose-600 dark:text-rose-400">{group.uploadError || 'Network or configuration error'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRetryUpload(group)}
                        disabled={retryingGroupId === group.id || !group.pdfBlob}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                      >
                        <RotateCw className={`w-3.5 h-3.5 ${retryingGroupId === group.id ? 'animate-spin' : ''}`} />
                        <span>{retryingGroupId === group.id ? 'Retrying...' : 'Retry Upload'}</span>
                      </button>
                    </div>
                  )}

                  {/* Unuploaded Notice if completed locally without public URL */}
                  {!group.pdfUrl && group.status === 'completed' && group.uploadStatus !== 'upload_failed' && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-2">
                        <CloudUpload className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-semibold">PDF generated locally (Included in ZIP)</div>
                          <div className="text-[11px] text-amber-700 dark:text-amber-400">Click to upload to free cloud hosting for direct Pinterest download links.</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRetryUpload(group)}
                        disabled={retryingGroupId === group.id || !group.pdfBlob}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                      >
                        <CloudUpload className={`w-3.5 h-3.5 ${retryingGroupId === group.id ? 'animate-spin' : ''}`} />
                        <span>{retryingGroupId === group.id ? 'Uploading...' : 'Upload to Cloud'}</span>
                      </button>
                    </div>
                  )}

                  {/* Generated Metadata Preview if available */}
                  {group.metadata && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AI Generated eBook Metadata</span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">{group.metadata.category}</span>
                      </div>

                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {group.metadata.ebookTitle}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {group.metadata.subtitle}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {group.metadata.shortDescription}
                      </div>

                      {group.metadata.seoKeywords && group.metadata.seoKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {group.metadata.seoKeywords.slice(0, 6).map((kw, ki) => (
                            <span
                              key={ki}
                              className="text-[10px] bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Image Filmstrip */}
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Assigned Image Sequence ({group.imageItems.length} pages)
                    </div>

                    <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pr-2">
                      {group.imageItems.map((item, imgIdx) => (
                        <div
                          key={item.id}
                          className="flex-shrink-0 w-20 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                        >
                          <div className="relative aspect-square bg-slate-200/50 dark:bg-slate-900">
                            <img
                              src={item.previewUrl}
                              alt={item.filename}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1 py-0.2 rounded">
                              p.{imgIdx + 1}
                            </div>
                          </div>
                          <div className="p-1 text-[10px] text-slate-600 dark:text-slate-400 truncate text-center" title={item.filename}>
                            {item.filename}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PDF Cover Section */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-indigo-500" />
                        <span>eBook Front Cover</span>
                      </div>

                      {settings.generateCover && settings.coverTheme !== 'none' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCoverPreview(group)}
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-200/60 dark:border-indigo-900/40 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview Cover Mockup</span>
                        </button>
                      ) : null}
                    </div>

                    {(!settings.generateCover || settings.coverTheme === 'none') ? (
                      <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                        <Ban className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>No cover selected for this PDF. The document begins directly on Page 1 with content.</span>
                      </div>
                    ) : group.coverDataUrl ? (
                      <div className="flex items-center gap-3.5 p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <img
                          src={group.coverDataUrl}
                          alt="Cover Preview"
                          className="w-14 h-20 object-cover rounded-md border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:opacity-90"
                          onClick={() => handleOpenCoverPreview(group)}
                        />
                        <div className="text-xs space-y-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span>Front Cover Page Rendered</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded">Ready</span>
                          </div>
                          <div className="text-slate-500">
                            Theme: <strong className="text-slate-700 dark:text-slate-300">{COVER_THEMES_CATALOG.find(t => t.id === settings.coverTheme)?.name || settings.coverTheme || 'Modern'}</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenCoverPreview(group)}
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Maximize2 className="w-3 h-3" />
                            <span>Inspect Full Cover</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            Cover Theme: <strong className="text-indigo-600 dark:text-indigo-400">{COVER_THEMES_CATALOG.find(t => t.id === settings.coverTheme)?.name || 'Modern Tech'}</strong>
                          </span>
                          <p className="text-[11px] text-slate-400">Generated on batch export using this group's first image.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenCoverPreview(group)}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Preview Now</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* High-Resolution Cover Preview Modal */}
      {previewingCoverGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-lg w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setPreviewingCoverGroup(null);
                setPreviewCoverDataUrl(null);
              }}
              className="absolute -top-10 right-0 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoadingCover ? (
              <div className="p-12 text-center text-white space-y-3">
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-sm font-medium">Rendering high-resolution cover preview...</div>
              </div>
            ) : previewCoverDataUrl ? (
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 max-h-[80vh] flex items-center justify-center bg-black">
                <img
                  src={previewCoverDataUrl}
                  alt="Volume Cover Preview"
                  className="max-h-[80vh] w-auto object-contain"
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-300">
                <Ban className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <div className="font-bold text-sm">No Cover Selected</div>
                <div className="text-xs text-slate-500 mt-1">
                  This volume is set to have no cover (direct to content).
                </div>
              </div>
            )}

            {previewCoverDataUrl && (
              <div className="text-center mt-3 text-xs text-white/90 font-medium flex items-center gap-2">
                <span className="font-bold text-white">{previewingCoverGroup.pdfFilename}</span>
                <span>•</span>
                <span>{COVER_THEMES_CATALOG.find(t => t.id === settings.coverTheme)?.name || 'Custom Theme'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

