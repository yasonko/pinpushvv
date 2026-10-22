import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  UploadCloud, 
  FolderPlus, 
  Sparkles, 
  Image as ImageIcon, 
  ShieldCheck,
  Check,
  FileCheck
} from 'lucide-react';

interface BulkUploaderProps {
  onFilesAdded: (files: File[]) => void;
  isProcessing?: boolean;
}

export const BulkUploader: React.FC<BulkUploaderProps> = ({
  onFilesAdded,
  isProcessing = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const validFiles: File[] = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/avif', 'image/tiff'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();
      const isAllowedExt = /\.(jpg|jpeg|png|webp|gif|heic|avif|tiff)$/i.test(name);
      if (allowedTypes.includes(file.type.toLowerCase()) || isAllowedExt) {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  }, [onFilesAdded]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Handle Global Paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isProcessing) return;
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        handleFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFiles, isProcessing]);

  // Generate Sample Demo Images for Quick Testing
  const handleLoadSampleImages = async () => {
    const sampleNames = ['matcha-dessert-shot.jpg', 'modern-living-room-interior.jpg', 'minimal-art-print.png'];
    const generatedFiles: File[] = [];

    for (let i = 0; i < sampleNames.length; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1500;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Gradient background
        const grad = ctx.createLinearGradient(0, 0, 1000, 1500);
        if (i === 0) {
          grad.addColorStop(0, '#10b981');
          grad.addColorStop(1, '#064e3b');
        } else if (i === 1) {
          grad.addColorStop(0, '#6366f1');
          grad.addColorStop(1, '#312e81');
        } else {
          grad.addColorStop(0, '#f43f5e');
          grad.addColorStop(1, '#881337');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1000, 1500);

        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Sample Image ${i + 1}`, 500, 700);
        ctx.font = '24px sans-serif';
        ctx.fillText(sampleNames[i], 500, 780);

        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.95));
        const file = new File([blob], sampleNames[i], { type: 'image/jpeg', lastModified: Date.now() });
        generatedFiles.push(file);
      }
    }

    onFilesAdded(generatedFiles);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        data-dropzone="true"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
          isDragOver
            ? 'border-[#E60023] bg-red-50/50 dark:bg-red-950/20 scale-[0.99]'
            : 'border-slate-300 dark:border-white/[0.12] bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl hover:border-slate-400 dark:hover:border-white/[0.2] shadow-sm'
        } ${isProcessing ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/avif,image/tiff"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-ignore
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <div className="w-16 h-16 mb-4 rounded-2xl bg-indigo-50 dark:bg-white/[0.04] border border-indigo-200 dark:border-white/[0.08] flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shadow-inner">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          Drag & Drop Images Here, or <span className="text-[#E60023] underline">Browse Files</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
          Supports <span className="font-semibold text-slate-700 dark:text-slate-300">JPG, PNG, WEBP, HEIC, AVIF</span>. Process hundreds of images simultaneously directly in your browser.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Select Image Files</span>
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Upload Whole Folder</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSampleImages}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-white/[0.04] text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-white/[0.08] border border-indigo-200 dark:border-indigo-800/60 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Try Sample Images</span>
          </button>
        </div>
      </div>
    </div>
  );
};
