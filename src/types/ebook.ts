export type PdfPageSize = 'A4' | 'LETTER' | 'SQUARE' | 'CUSTOM';
export type PdfOrientation = 'portrait' | 'landscape' | 'auto';
export type PdfImageFit = 'contain' | 'cover';
export type PdfQuality = 'standard' | 'high';
export type PdfMarginSize = 'none' | 'small' | 'medium';
export type EbookBatchStatus = 'idle' | 'preparing' | 'processing' | 'paused' | 'completed' | 'failed';
export type EbookGroupStatus = 'pending' | 'analyzing_ai' | 'generating_pdf' | 'uploading' | 'completed' | 'failed';
export type PdfUploadStatus = 'pending' | 'uploading' | 'completed' | 'upload_failed';
export type StorageProviderType = 'postfile' | 'free_host' | 'cloudinary' | 'supabase' | 'r2' | 's3' | 'firebase';

export interface StorageConfig {
  provider: StorageProviderType;
  customDomain?: string;
  postfile?: {
    apiKey: string;
  };
  cloudinary?: {
    cloudName: string;
    apiKey: string;
    apiSecret?: string;
    uploadPreset?: string;
    folder?: string;
  };
  r2?: {
    accountId: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicDomain: string;
  };
  supabase?: {
    projectUrl: string;
    apiKey: string;
    bucket: string;
  };
  s3?: {
    endpoint?: string;
    bucket: string;
    region?: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicUrlBase: string;
  };
  firebase?: {
    storageBucket: string;
    apiKey?: string;
  };
}

export type CoverThemeType =
  | 'none'
  | 'modern'
  | 'minimal'
  | 'playful'
  | 'elegant'
  | 'dark'
  | 'nature'
  | 'magazine'
  | 'vintage'
  | 'gradient';

export interface PdfSettings {
  imagesPerPdf: number;
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  imageFit: PdfImageFit;
  quality: PdfQuality;
  margins: PdfMarginSize;
  pageNumbers: boolean;
  pageNumberPosition?: 'bottom-center' | 'bottom-right' | 'bottom-left';
  generateCover: boolean;
  addCoverAsFirstPage: boolean;
  generateBackCover: boolean;
  coverTheme?: CoverThemeType;
  authorName?: string;
  namingPrefix: string;
  startNumber: number;
  pdfFolderInZip: boolean;
  customWidthMm?: number;
  customHeightMm?: number;
  pinterestIntegration: boolean;
  defaultBoardId?: string;
  defaultWebsiteId?: string;
  storageConfig?: StorageConfig;
  autoUploadPdf?: boolean;
}

export interface EbookImageItem {
  id: string;
  file?: File;
  filename: string;
  originalIndex: number;
  sequenceNumber: number; // 1-based sequential rank
  dataUrl?: string;
  previewUrl: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  title?: string;
  description?: string;
  tags?: string[];
  importedFromPinId?: string;
}

export interface EbookMetadata {
  ebookTitle: string;
  subtitle: string;
  shortDescription: string;
  longDescription: string;
  mainTopic: string;
  audience: string;
  category: string;
  seoKeywords: string[];
  pinterestKeywords: string[];
  pinterestTitle: string;
  pinterestDescription: string;
  coverUrl?: string;
  pdfUrl?: string;
  uploadStatus?: PdfUploadStatus;
  uploadedAt?: string;
  storageProvider?: string;
  remotePath?: string;
  fileSize?: number;
}

export interface EbookGroup {
  id: string;
  groupIndex: number; // 0-based
  pdfNumberFormatted: string; // "001", "002"
  pdfFilename: string; // "Cute_Animals_001.pdf"
  imageItems: EbookImageItem[];
  startIndex: number; // 1-based start
  endIndex: number; // 1-based end
  imageCount: number;
  status: EbookGroupStatus;
  statusMessage?: string;
  error?: string | null;
  retryCount?: number;
  metadata?: EbookMetadata;
  pdfBlob?: Blob;
  pdfFileSize?: number;
  pdfFileSizeBytes?: number;
  coverDataUrl?: string;
  completedAt?: string;
  boardId?: string;
  destinationUrl?: string;

  // PDF Public Upload & Hosting Information
  uploadStatus: PdfUploadStatus;
  pdfUrl: string; // Real Public HTTPS URL
  uploadedAt?: string;
  storageProvider?: string;
  remotePath?: string;
  uploadError?: string | null;
  uploadAttempts?: number;
}

export interface EbookBatch {
  id: string;
  hash: string;
  createdAt: string;
  updatedAt: string;
  status: EbookBatchStatus;
  settings: PdfSettings;
  images: EbookImageItem[];
  groups: EbookGroup[];
  totalImages: number;
  totalPdfs: number;
  completedPdfs: number;
  failedPdfs: number;
  uploadedPdfs?: number;
  failedUploads?: number;
  currentProcessingGroupIndex?: number;
  zipBlob?: Blob;
  zipFilename?: string;
  excelBlob?: Blob;
  excelFilename?: string;
  errorMessage?: string | null;
}

export interface EbookProgressState {
  currentStage: 'idle' | 'sorting' | 'grouping' | 'ai_metadata' | 'pdf_rendering' | 'uploading_pdf' | 'excel_export' | 'zip_packaging' | 'finished';
  currentGroupIndex: number;
  totalGroups: number;
  currentImageIndex: number;
  totalImages: number;
  percentage: number;
  detailMessage: string;
  currentUploadIndex?: number;
  totalUploads?: number;
  completedUploads?: number;
  failedUploads?: number;
  startTime?: number;
  estimatedRemainingSec?: number;
}
