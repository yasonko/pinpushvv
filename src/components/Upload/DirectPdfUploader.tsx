import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  Trash2, 
  RotateCw, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  HardDrive, 
  Settings, 
  HelpCircle,
  FileCheck,
  Ban,
  Layers,
  Link2
} from 'lucide-react';
import { 
  DirectPdfItem, 
  extractFastPdfMetadata, 
  uploadDirectPdfFile, 
  exportDirectPdfSheet 
} from '../../services/ebook/directPdfService';
import { 
  getSavedStorageConfig, 
  SUPPORTED_STORAGE_PROVIDERS, 
  isStorageConfigured 
} from '../../services/ebook/pdfStorageService';
import { StorageConfig } from '../../types/ebook';
import { formatBytes } from '../../services/ebook/excelGenerator';

interface DirectPdfUploaderProps {
  onBackToPinsMode?: () => void;
  className?: string;
}

export const DirectPdfUploader: React.FC<DirectPdfUploaderProps> = ({
  onBackToPinsMode,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<DirectPdfItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [autoUpload, setAutoUpload] = useState(true);
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(getSavedStorageConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Sync saved storage config
  useEffect(() => {
    setStorageConfig(getSavedStorageConfig());
  }, []);

  // Handle adding PDF files
  const handlePdfFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const validPdfs: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        validPdfs.push(f);
      }
    }

    if (validPdfs.length === 0) {
      alert('Please select valid PDF files (.pdf)');
      return;
    }

    const newItems: DirectPdfItem[] = [];

    for (let i = 0; i < validPdfs.length; i++) {
      const file = validPdfs[i];
      const id = `direct_pdf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`;

      try {
        // Fast metadata extraction without canvas rendering
        const meta = await extractFastPdfMetadata(file);

        const item: DirectPdfItem = {
          id,
          file,
          filename: file.name,
          title: meta.title,
          fileSizeBytes: file.size,
          pageCount: meta.pageCount,
          uploadStatus: 'idle',
          uploadProgress: 0,
        };

        newItems.push(item);
      } catch (err) {
        console.warn('Failed to parse fast PDF header for:', file.name, err);
        newItems.push({
          id,
          file,
          filename: file.name,
          title: file.name.replace(/\.pdf$/i, ''),
          fileSizeBytes: file.size,
          pageCount: 1,
          uploadStatus: 'idle',
          uploadProgress: 0,
        });
      }
    }

    setItems((prev) => [...prev, ...newItems]);

    // Auto-trigger uploads if enabled
    if (autoUpload) {
      setTimeout(() => {
        uploadPendingItems(newItems);
      }, 50);
    }
  };

  // Upload a list of items sequentially/concurrently with progress updates
  const uploadPendingItems = async (targets: DirectPdfItem[]) => {
    if (isProcessingBatch || targets.length === 0) return;
    setIsProcessingBatch(true);

    const activeConfig = getSavedStorageConfig();

    for (const target of targets) {
      // Update item to uploading state
      setItems((prev) =>
        prev.map((item) =>
          item.id === target.id
            ? { ...item, uploadStatus: 'uploading', uploadProgress: 15, error: undefined }
            : item
        )
      );

      try {
        const result = await uploadDirectPdfFile(target, activeConfig, (pct) => {
          setItems((prev) =>
            prev.map((item) =>
              item.id === target.id ? { ...item, uploadProgress: Math.max(15, pct) } : item
            )
          );
        });

        // Mark as completed
        setItems((prev) =>
          prev.map((item) =>
            item.id === target.id
              ? {
                  ...item,
                  uploadStatus: 'completed',
                  uploadProgress: 100,
                  publicUrl: result.publicUrl,
                  storageProvider: result.storageProvider,
                  uploadedAt: result.uploadedAt,
                }
              : item
          )
        );
      } catch (err: any) {
        console.error('Direct PDF upload failed for', target.filename, err);
        setItems((prev) =>
          prev.map((item) =>
            item.id === target.id
              ? {
                  ...item,
                  uploadStatus: 'failed',
                  uploadProgress: 0,
                  error: err.message || 'Upload failed. Please retry.',
                }
              : item
          )
        );
      }
    }

    setIsProcessingBatch(false);
  };

  // Retry upload for a single item
  const handleRetryItem = (item: DirectPdfItem) => {
    if (item.file) {
      uploadPendingItems([item]);
    }
  };

  // Upload all pending/failed items
  const handleUploadAllPending = () => {
    const pending = items.filter((i) => i.uploadStatus === 'idle' || i.uploadStatus === 'failed');
    if (pending.length > 0) {
      uploadPendingItems(pending);
    }
  };

  // Copy single link
  const handleCopyLink = (item: DirectPdfItem) => {
    if (!item.publicUrl) return;
    navigator.clipboard.writeText(item.publicUrl);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy all links
  const handleCopyAllLinks = () => {
    const links = items
      .filter((i) => i.publicUrl)
      .map((i) => i.publicUrl)
      .join('\n');

    if (!links) {
      alert('No uploaded PDF links available yet. Please upload files first.');
      return;
    }

    navigator.clipboard.writeText(links);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Export Sheet (Excel or CSV)
  const handleExportSheet = (format: 'xlsx' | 'csv') => {
    if (items.length === 0) {
      alert('Please upload at least one PDF to export the sheet.');
      return;
    }

    const uploadedCount = items.filter((i) => i.publicUrl).length;
    exportDirectPdfSheet(items, format, 'PDF_Direct_Links');
    
    setExportNotice(
      `Exported ${items.length} PDF entries (${uploadedCount} live links) to ${format.toUpperCase()}!`
    );
    setTimeout(() => setExportNotice(null), 4000);
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Clear all
  const handleClearAll = () => {
    if (items.length === 0) return;
    if (confirm(`Remove all ${items.length} PDF items from the list?`)) {
      setItems([]);
    }
  };

  // Update item title
  const handleUpdateTitle = (id: string, newTitle: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, title: newTitle } : i))
    );
  };

  const completedCount = items.filter((i) => i.uploadStatus === 'completed' && i.publicUrl).length;
  const totalSize = items.reduce((acc, i) => acc + i.fileSizeBytes, 0);
  const activeProvider = SUPPORTED_STORAGE_PROVIDERS.find((p) => p.id === storageConfig.provider);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner & Mode Toggle */}
      <div className="bg-gradient-to-r from-red-600/10 via-rose-500/5 to-transparent dark:from-red-950/40 dark:via-rose-950/20 p-5 rounded-3xl border border-red-200/80 dark:border-red-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
              Direct Mode
            </span>
            <span className="text-xs font-bold text-red-600 dark:text-red-400">
              No Image Extraction • Instant Cloud Link & Sheet
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Direct PDF Uploader & Spreadsheet Exporter
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
            Upload whole PDF files directly to cloud storage without slicing or rendering canvas images. Instantly get public HTTPS download links and export an Excel (.xlsx) or CSV spreadsheet.
          </p>
        </div>

        {onBackToPinsMode && (
          <button
            type="button"
            onClick={onBackToPinsMode}
            className="self-start md:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-black/60 hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-white/[0.1] shadow-xs cursor-pointer transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Switch to Extract Pages as Pins</span>
          </button>
        )}
      </div>

      {/* Storage Provider Status Bar */}
      <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/40 flex items-center justify-center text-[#E60023] shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Storage Provider:</span>
              <span className="text-[#E60023] font-extrabold">{activeProvider?.name || 'PostFile / Free Host'}</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-bold">
                Ready
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Generates permanent verified HTTPS download links for your spreadsheet.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
            <input
              type="checkbox"
              checked={autoUpload}
              onChange={(e) => setAutoUpload(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-red-600 focus:ring-red-500"
            />
            <span>Auto-upload on drop</span>
          </label>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (e.dataTransfer?.files?.length) {
            handlePdfFiles(e.dataTransfer.files);
          }
        }}
        className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all flex flex-col items-center justify-center gap-3 relative cursor-pointer ${
          isDragging
            ? 'border-[#E60023] bg-red-500/10 scale-[0.99]'
            : 'border-slate-300 dark:border-white/[0.15] hover:border-red-400 dark:hover:border-red-800 bg-white/70 dark:bg-black/40'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files && handlePdfFiles(e.target.files)}
        />

        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/40 flex items-center justify-center text-[#E60023] shadow-xs">
          <UploadCloud className="w-8 h-8 animate-bounce-slow" />
        </div>

        <div className="space-y-1">
          <div className="text-base font-extrabold text-slate-900 dark:text-white">
            Drop your PDF files here, or <span className="text-[#E60023] hover:underline">browse</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Upload 1 to 100+ PDF files directly. No page splitting or image extracting. Fast & light on memory.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 text-[11px] font-mono font-medium">
            PDF files only (.pdf)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 text-[11px] font-mono font-medium">
            Up to 100MB+ per file
          </span>
        </div>
      </div>

      {/* Export & Actions Toolbar */}
      {items.length > 0 && (
        <div className="bg-white/90 dark:bg-black/60 dark:backdrop-blur-xl p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-500" />
              <span>{items.length} PDF{items.length !== 1 ? 's' : ''} Listed</span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                {completedCount} Live Link{completedCount !== 1 ? 's' : ''} Ready
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 font-mono">{formatBytes(totalSize)}</span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Upload pending if any */}
            {items.some((i) => i.uploadStatus === 'idle' || i.uploadStatus === 'failed') && (
              <button
                type="button"
                onClick={handleUploadAllPending}
                disabled={isProcessingBatch}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 transition-all"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isProcessingBatch ? 'animate-spin' : ''}`} />
                <span>Upload All Pending</span>
              </button>
            )}

            {/* Copy All Links */}
            <button
              type="button"
              onClick={handleCopyAllLinks}
              disabled={completedCount === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200/80 dark:border-white/[0.08] cursor-pointer disabled:opacity-40 transition-colors"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">All Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy All Links</span>
                </>
              )}
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={() => handleExportSheet('csv')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200/80 dark:border-white/[0.08] cursor-pointer transition-colors"
              title="Export as CSV for Google Sheets / Excel / Pinterest Bulk"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span>Export CSV (.csv)</span>
            </button>

            {/* Export Excel */}
            <button
              type="button"
              onClick={() => handleExportSheet('xlsx')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs cursor-pointer transition-all active:scale-95"
              title="Export formatted Excel Spreadsheet with clickable PDF download links"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Sheet (.xlsx)</span>
            </button>

            {/* Clear All */}
            <button
              type="button"
              onClick={handleClearAll}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 transition-colors cursor-pointer"
              title="Clear all files from list"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Export Notice Notification */}
      {exportNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">Check Downloads</span>
        </div>
      )}

      {/* PDF Items List */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const isCompleted = item.uploadStatus === 'completed' && item.publicUrl;
            const isUploading = item.uploadStatus === 'uploading';
            const isFailed = item.uploadStatus === 'failed';
            const isCopied = copiedId === item.id;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isCompleted
                    ? 'bg-white/90 dark:bg-black/60 border-slate-200/80 dark:border-white/[0.08] shadow-xs'
                    : isUploading
                    ? 'bg-red-50/20 dark:bg-red-950/10 border-red-300 dark:border-red-900/60'
                    : isFailed
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                    : 'bg-white/70 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/[0.06]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-red-100/70 dark:bg-red-950/60 border border-red-200 dark:border-red-900/40 flex items-center justify-center text-[#E60023] shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-slate-400 text-xs">#{idx + 1}</span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateTitle(item.id, e.target.value)}
                          className="font-bold text-sm text-slate-900 dark:text-white bg-transparent hover:bg-slate-100/70 dark:hover:bg-white/[0.06] focus:bg-white dark:focus:bg-slate-900 px-1.5 py-0.5 rounded border border-transparent focus:border-red-300 dark:focus:border-red-700 outline-none transition-all max-w-md truncate"
                          title="Click to edit eBook / PDF Title"
                        />
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.2 rounded">
                          {item.filename}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono">{formatBytes(item.fileSizeBytes)}</span>
                        <span>•</span>
                        <span>{item.pageCount || 1} Pages (Direct)</span>
                        {item.storageProvider && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              {item.storageProvider}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Upload Status & Live Link Box */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {isUploading ? (
                      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/40 text-xs text-red-600 font-bold">
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading ({item.uploadProgress}%)</span>
                      </div>
                    ) : isCompleted ? (
                      <div className="flex items-center gap-2">
                        {/* URL Box & Copy */}
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-white/[0.08] max-w-xs md:max-w-sm">
                          <Link2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-xs font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px] select-all">
                            {item.publicUrl}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item)}
                            className="p-1 rounded-md hover:bg-white dark:hover:bg-black/60 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
                            title="Copy link to clipboard"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Open link button */}
                        <a
                          href={item.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/[0.08] transition-colors cursor-pointer"
                          title="Open PDF in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : isFailed ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRetryItem(item)}
                          className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRetryItem(item)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Upload Now
                      </button>
                    )}

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title="Remove from list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar if uploading */}
                {isUploading && (
                  <div className="w-full bg-slate-200 dark:bg-white/[0.1] h-1.5 rounded-full overflow-hidden mt-3">
                    <div
                      className="bg-red-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${item.uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
