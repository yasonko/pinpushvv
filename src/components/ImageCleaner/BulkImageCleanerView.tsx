import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  Info, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  FileCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  CleanedImageItem, 
  ImageCleanerSettings, 
  DEFAULT_CLEANER_SETTINGS 
} from '../../types/imageCleaner';
import { 
  imageCleanerQueue, 
  ImageCleanerQueueState 
} from '../../services/imageCleanerQueue';
import { BulkUploader } from './BulkUploader';
import { SettingsPanel } from './SettingsPanel';
import { BulkControls } from './BulkControls';
import { ImageQueueTable } from './ImageQueueTable';
import { ImageQueueGrid } from './ImageQueueGrid';
import { MetadataInspectorModal } from './MetadataInspectorModal';
import { ProcessingDetailsModal } from './ProcessingDetailsModal';
import { TestSuiteModal } from './TestSuiteModal';
import { Pin } from '../../types';

interface BulkImageCleanerViewProps {
  onPinsCreated?: (pins: Pin[]) => void;
  defaultBoardId?: string;
  defaultWebsiteId?: string;
}

export const BulkImageCleanerView: React.FC<BulkImageCleanerViewProps> = ({
  onPinsCreated,
  defaultBoardId,
  defaultWebsiteId,
}) => {
  const [queueState, setQueueState] = useState<ImageCleanerQueueState>(() => imageCleanerQueue.getState());
  const [settings, setSettings] = useState<ImageCleanerSettings>(() => ({ ...DEFAULT_CLEANER_SETTINGS }));
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showSettings, setShowSettings] = useState(true);

  // Modals state
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<CleanedImageItem | null>(null);
  const [selectedMetadataItem, setSelectedMetadataItem] = useState<CleanedImageItem | null>(null);
  const [showTestSuite, setShowTestSuite] = useState(false);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  // Subscribe to queue changes
  useEffect(() => {
    const unsubscribe = imageCleanerQueue.subscribe((state) => {
      setQueueState(state);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateSettings = (partial: Partial<ImageCleanerSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleFilesAdded = (files: File[]) => {
    imageCleanerQueue.addFiles(files);
  };

  const handleStartProcessing = () => {
    imageCleanerQueue.startProcessing(settings);
  };

  const handlePause = () => {
    imageCleanerQueue.pause();
  };

  const handleResume = () => {
    imageCleanerQueue.resume(settings);
  };

  const handleCancel = () => {
    imageCleanerQueue.cancel();
  };

  const handleRetryFailed = () => {
    imageCleanerQueue.retryFailed(settings);
  };

  const handleDownloadZip = () => {
    imageCleanerQueue.downloadZip();
  };

  const handleRemoveItem = (id: string) => {
    imageCleanerQueue.removeItem(id);
  };

  const handleClearAll = () => {
    imageCleanerQueue.clearAll();
  };

  // Convert cleaned images to Pin Publisher Pro Library items
  const handleSendToPinLibrary = () => {
    if (!onPinsCreated) return;

    const successfulItems = queueState.items.filter(
      (it) => (it.status === 'success' || it.status === 'warning') && it.processedFile
    );

    if (successfulItems.length === 0) return;

    const newPins: Pin[] = successfulItems.map((item, idx) => {
      const processed = item.processedFile!;
      const cleanTitle = processed.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

      return {
        id: `pin_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        description: '',
        mediaUrl: processed.downloadUrl,
        thumbnailUrl: processed.dataUrl,
        sourceType: 'bulk-cleaner',
        status: 'draft',
        boardId: defaultBoardId || '',
        websiteId: defaultWebsiteId || '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dimensions: {
          width: processed.width,
          height: processed.height,
        },
      };
    });

    onPinsCreated(newPins);
    setImportNotification(`Successfully imported ${newPins.length} cleaned images into Pin Library!`);
    setTimeout(() => setImportNotification(null), 5000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl p-6 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-white/[0.04] border border-indigo-200 dark:border-white/[0.08] flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Bulk Image Metadata Cleaner & Image Normalizer
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/60">
                100% Client-Side Privacy
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Clean EXIF/IPTC/XMP/GPS metadata, normalize dimensions & compression, and standardize SEO filenames for hundreds of images with verified binary re-inspection before publishing to Pinterest.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setShowTestSuite(true)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-white/[0.04] hover:bg-indigo-100 dark:hover:bg-white/[0.08] text-indigo-700 dark:text-indigo-300 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>Regression Tests</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>{showSettings ? 'Hide Rules' : 'Configure Rules'}</span>
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Privacy & Compliance Assurance Notice */}
      <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
        <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            Local Security Sandbox & Privacy Compliance Guarantee
          </div>
          <p>
            Your photos are decoded and stripped purely inside your browser memory using HTML5 Canvas & binary parsers. Zero images, GPS coordinates, or camera identifiers ever leave your machine.
          </p>
        </div>
      </div>

      {/* Import Notification Toast */}
      {importNotification && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-3 text-xs font-bold text-emerald-800 dark:text-emerald-200 animate-slideDown">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>{importNotification}</span>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          disabled={queueState.isProcessing}
        />
      )}

      {/* Bulk Uploader Zone */}
      <BulkUploader
        onFilesAdded={handleFilesAdded}
        isProcessing={queueState.isProcessing}
      />

      {/* Bulk Controls (Actions, Progress, Filters) */}
      {queueState.totalCount > 0 && (
        <BulkControls
          queueState={queueState}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
          onStartProcessing={handleStartProcessing}
          onPause={handlePause}
          onResume={handleResume}
          onCancel={handleCancel}
          onRetryFailed={handleRetryFailed}
          onDownloadZip={handleDownloadZip}
          onSendToPinLibrary={onPinsCreated ? handleSendToPinLibrary : undefined}
          onClearAll={handleClearAll}
        />
      )}

      {/* Image Queue Table / Grid */}
      {queueState.totalCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider">
              Image Queue Items ({queueState.totalCount})
            </span>
            <span>Click any item for detailed before/after comparison</span>
          </div>

          {viewMode === 'table' ? (
            <ImageQueueTable
              items={queueState.items}
              onOpenDetails={(item) => setSelectedDetailsItem(item)}
              onOpenMetadata={(item) => setSelectedMetadataItem(item)}
              onRemoveItem={handleRemoveItem}
            />
          ) : (
            <ImageQueueGrid
              items={queueState.items}
              onOpenDetails={(item) => setSelectedDetailsItem(item)}
              onOpenMetadata={(item) => setSelectedMetadataItem(item)}
              onRemoveItem={handleRemoveItem}
            />
          )}
        </div>
      )}

      {/* Modals */}
      {selectedMetadataItem && (
        <MetadataInspectorModal
          item={selectedMetadataItem}
          onClose={() => setSelectedMetadataItem(null)}
        />
      )}

      {selectedDetailsItem && (
        <ProcessingDetailsModal
          item={selectedDetailsItem}
          onClose={() => setSelectedDetailsItem(null)}
          onOpenMetadataInspector={(item) => {
            setSelectedDetailsItem(null);
            setSelectedMetadataItem(item);
          }}
        />
      )}

      {showTestSuite && (
        <TestSuiteModal
          isOpen={showTestSuite}
          onClose={() => setShowTestSuite(false)}
        />
      )}
    </div>
  );
};
