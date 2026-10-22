import React, { useState } from 'react';
import { EbookImageItem } from '../../types/ebook';
import { 
  ArrowDownAZ, 
  ArrowUpAZ, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Layers, 
  Shuffle, 
  RotateCcw,
  CheckSquare,
  Square,
  Eye,
  FileImage
} from 'lucide-react';
import { sortImagesNaturally, sortByUploadOrder, moveImageItem, reindexImageSequences } from '../../services/ebook/imageSorter';

interface EbookImageGridProps {
  images: EbookImageItem[];
  onImagesChange: (images: EbookImageItem[]) => void;
  imagesPerPdf: number;
  onPreviewImage?: (item: EbookImageItem) => void;
}

export const EbookImageGrid: React.FC<EbookImageGridProps> = ({
  images,
  onImagesChange,
  imagesPerPdf,
  onPreviewImage,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSortAsc = () => {
    onImagesChange(sortImagesNaturally(images, 'asc'));
  };

  const handleSortDesc = () => {
    onImagesChange(sortImagesNaturally(images, 'desc'));
  };

  const handleSortUpload = () => {
    onImagesChange(sortByUploadOrder(images));
  };

  const handleShuffle = () => {
    const shuffled = [...images].sort(() => Math.random() - 0.5);
    onImagesChange(reindexImageSequences(shuffled));
  };

  const handleReverse = () => {
    const reversed = [...images].reverse();
    onImagesChange(reindexImageSequences(reversed));
  };

  const handleRemove = (id: string) => {
    const filtered = images.filter((img) => img.id !== id);
    onImagesChange(reindexImageSequences(filtered));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    onImagesChange(moveImageItem(images, fromIndex, toIndex));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((i) => i.id)));
    }
  };

  const deleteSelected = () => {
    const filtered = images.filter((img) => !selectedIds.has(img.id));
    onImagesChange(reindexImageSequences(filtered));
    setSelectedIds(new Set());
  };

  const clearAll = () => {
    onImagesChange([]);
    setSelectedIds(new Set());
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {selectedIds.size === images.length ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>{selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'Select All'}</span>
          </button>

          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {images.length} {images.length === 1 ? 'Image' : 'Images'} (Sequenced)
          </span>
        </div>

        {/* Sort & Action Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleSortAsc}
            title="Sort numbers/names 1 to 999 naturally"
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <ArrowDownAZ className="w-3.5 h-3.5" />
            <span>Sort 1-999</span>
          </button>

          <button
            onClick={handleSortDesc}
            title="Sort numbers/names 999 to 1 naturally"
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <ArrowUpAZ className="w-3.5 h-3.5" />
            <span>Sort 999-1</span>
          </button>

          <button
            onClick={handleSortUpload}
            title="Sort by original upload sequence"
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Upload Order</span>
          </button>

          <button
            onClick={handleShuffle}
            title="Randomize image sequence"
            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Shuffle</span>
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={deleteSelected}
              className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ml-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}

          <button
            onClick={clearAll}
            className="px-2.5 py-1.5 text-slate-400 hover:text-rose-500 rounded-lg text-xs font-medium transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Grid Display */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 max-h-[520px] overflow-y-auto pr-1">
        {images.map((item, idx) => {
          const isSelected = selectedIds.has(item.id);
          const pdfGroupNumber = Math.floor(idx / Math.max(1, imagesPerPdf)) + 1;
          const isGroupStart = idx % imagesPerPdf === 0;

          return (
            <div
              key={item.id}
              className={`group relative bg-slate-50 dark:bg-slate-800/60 border rounded-xl overflow-hidden transition-all flex flex-col ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                  : 'border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {/* Group Boundary Indicator Badge */}
              {isGroupStart && (
                <div className="absolute top-1.5 left-1.5 z-10 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                  <Layers className="w-2.5 h-2.5" />
                  <span>PDF #{pdfGroupNumber}</span>
                </div>
              )}

              {/* Sequence Rank Badge */}
              <div className="absolute top-1.5 right-1.5 z-10 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                #{item.sequenceNumber}
              </div>

              {/* Thumbnail Container */}
              <div 
                className="relative aspect-square w-full bg-slate-200/50 dark:bg-slate-900/50 overflow-hidden cursor-pointer flex items-center justify-center"
                onClick={() => toggleSelect(item.id)}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.filename}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <FileImage className="w-8 h-8 text-slate-400" />
                )}

                {/* Hover Quick Actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                  {idx > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(idx, idx - 1);
                      }}
                      title="Move Up"
                      className="p-1.5 bg-white/90 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg hover:bg-white text-xs"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {idx < images.length - 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(idx, idx + 1);
                      }}
                      title="Move Down"
                      className="p-1.5 bg-white/90 dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg hover:bg-white text-xs"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                    title="Remove Image"
                    className="p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filename & Info */}
              <div className="p-2 text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate" title={item.filename}>
                {item.filename}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
