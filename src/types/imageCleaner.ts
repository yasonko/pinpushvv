export type CleanerProcessStatus = 
  | 'idle' 
  | 'reading' 
  | 'cleaning' 
  | 'normalizing' 
  | 'renaming' 
  | 'exporting' 
  | 'verifying' 
  | 'success' 
  | 'warning' 
  | 'failed';

export type SubStepState = 'pending' | 'active' | 'success' | 'warning' | 'failed';

export interface StepProgressState {
  validate: SubStepState;
  readMetadata: SubStepState;
  cleanMetadata: SubStepState;
  normalize: SubStepState;
  rename: SubStepState;
  export: SubStepState;
  verify: SubStepState;
}

export type MetadataCategory = 
  | 'EXIF_CAMERA'
  | 'EXIF_GPS'
  | 'EXIF_DATETIME'
  | 'EXIF_PERSONAL'
  | 'EXIF_MAKER_NOTES'
  | 'EXIF_THUMBNAIL'
  | 'UNIQUE_IDENTIFIER'
  | 'IPTC'
  | 'IPTC_PERSONAL'
  | 'XMP'
  | 'XMP_PERSONAL'
  | 'XMP_ORGANIZATIONAL'
  | 'XMP_EDITING_HISTORY'
  | 'XMP_REGION'
  | 'XMP_PROVENANCE'
  | 'COPYRIGHT_CONTACT'
  | 'ICC_COLOR_PROFILE'
  | 'COLOR_TECHNICAL'
  | 'PROPRIETARY_METADATA'
  | 'CONTAINER_STRUCTURE'
  | 'INTERNAL_RAW'
  | 'UNKNOWN';

export interface NormalizedMetadataEntry {
  category: MetadataCategory;
  namespace: string; // 'EXIF' | 'GPS' | 'IPTC' | 'XMP' | 'ICC' | 'CONTAINER' | 'FILE' | 'RIFF' | 'PNG' | 'MakerNote' | 'UNKNOWN'
  key: string;
  displayName: string;
  value: string | number;
  valueType: 'string' | 'number' | 'array' | 'object' | 'boolean';
  source: string;
  isPersonal?: boolean;
  rawDetails?: any;
}

export interface MetadataTagEntry {
  key: string;
  label: string;
  value: string | number;
  category: 'exif' | 'iptc' | 'xmp' | 'gps' | 'camera' | 'software' | 'date' | 'copyright' | 'icc' | 'container' | 'other';
  isPersonal?: boolean;
}

export interface ParsedImageMetadata {
  hasMetadata: boolean;
  totalFieldCount: number;
  
  // Categorized counts
  exifCount: number;
  iptcCount: number;
  xmpCount: number;
  gpsCount: number;
  iccCount: number;
  containerCount: number;

  // New specific category counts & flags
  dateTimeCount?: number;
  hasDateTime?: boolean;
  makerNotesCount?: number;
  hasMakerNotes?: boolean;
  uniqueIdCount?: number;
  hasUniqueIds?: boolean;
  thumbnailCount?: number;
  hasThumbnail?: boolean;
  faceRegionCount?: number;
  hasFaceRegions?: boolean;
  editingHistoryCount?: number;
  hasEditingHistory?: boolean;
  copyrightCount?: number;
  hasCopyright?: boolean;
  provenanceCount?: number;
  hasProvenance?: boolean;
  organizationalCount?: number;
  hasOrganizational?: boolean;
  proprietaryCount?: number;
  hasProprietary?: boolean;

  hasGps: boolean;
  hasCameraInfo: boolean;
  hasPersonalInfo: boolean;
  hasIccProfile: boolean;

  // Orientation
  orientationTag?: number | string;
  hasOrientation?: boolean;
  
  // Specific summaries
  cameraMake?: string;
  cameraModel?: string;
  lensInfo?: string;
  software?: string;
  dateTime?: string;
  gpsCoordinates?: { lat: number; lng: number; altitude?: number; stringified?: string };
  creator?: string;
  byline?: string;
  copyright?: string;
  userComments?: string;
  
  // ICC summaries
  iccProfileDescription?: string;
  iccDeviceClass?: string;
  iccDeviceManufacturer?: string;
  iccDeviceModel?: string;

  // Camera & hardware metadata fields
  cameraFields: NormalizedMetadataEntry[];
  cameraFieldNames: string[];

  // Normalized semantic entries (excluding INTERNAL_RAW)
  normalizedEntries: NormalizedMetadataEntry[];

  // Raw/internal parser packet entries for developer/debug inspector
  rawEntries?: NormalizedMetadataEntry[];
  internalRawEntries?: NormalizedMetadataEntry[];

  // Legacy tag entries for UI compatibility
  tags: MetadataTagEntry[];
}

export interface MetadataDiffReport {
  exifBefore: number;
  exifAfter: number;
  exifRemoved: number;
  
  iptcBefore: number;
  iptcAfter: number;
  iptcRemoved: number;
  
  xmpBefore: number;
  xmpAfter: number;
  xmpRemoved: number;
  
  gpsBefore: boolean;
  gpsAfter: boolean;
  gpsRemoved: boolean;
  
  cameraBefore: boolean;
  cameraAfter: boolean;
  cameraRemoved: boolean;

  iccBefore: boolean;
  iccAfter: boolean;
  iccRemoved: boolean;
  iccPreserved: boolean;

  // Granular semantic diffs
  dateTimeBefore: number;
  dateTimeAfter: number;
  dateTimeRemoved: boolean;

  makerNotesBefore: boolean;
  makerNotesAfter: boolean;
  makerNotesRemoved: boolean;

  uniqueIdsBefore: number;
  uniqueIdsAfter: number;
  uniqueIdsRemoved: boolean;

  thumbnailBefore: boolean;
  thumbnailAfter: boolean;
  thumbnailRemoved: boolean;

  orientationBefore?: number | string;
  orientationAfter?: number | string;
  orientationNormalized: boolean;

  iptcPersonalBefore: number;
  iptcPersonalAfter: number;
  iptcPersonalRemoved: boolean;

  xmpPersonalBefore: number;
  xmpPersonalAfter: number;
  xmpPersonalRemoved: boolean;

  faceRegionsBefore: number;
  faceRegionsAfter: number;
  faceRegionsRemoved: boolean;

  editingHistoryBefore: number;
  editingHistoryAfter: number;
  editingHistoryRemoved: boolean;

  copyrightBefore: number;
  copyrightAfter: number;
  copyrightPreserved: boolean;
  copyrightRemoved: boolean;

  provenanceBefore: number;
  provenanceAfter: number;
  provenancePreserved: boolean;
  
  softwareRemoved: boolean;
  fieldsRemovedList: string[];
  preservedFieldsList: string[];

  // Detailed before/after camera audit & retained field enumeration
  cameraFieldsBeforeList: string[];
  cameraFieldsAfterList: string[];
  retainedCameraFields: NormalizedMetadataEntry[];
  retainedCameraDescriptions: string[];
  retainedGpsDescriptions: string[];
  retainedSensitiveFields: string[];
  retainedIccDescriptions: string[];
  retainedExifDescriptions: string[];
  retainedIptcDescriptions: string[];
  retainedXmpDescriptions: string[];
  retainedDateTimeDescriptions?: string[];
  retainedMakerNotesDescriptions?: string[];
  retainedUniqueIdDescriptions?: string[];
  retainedFaceRegionDescriptions?: string[];
}

export interface VerificationAuditItem {
  category: string;
  beforeDisplay: string;
  afterDisplay: string;
  passed: boolean;
  statusText: string;
  reason?: string;
  retainedFields?: Array<{ field: string; reason: string }>;
}

export interface RetainedFieldWarning {
  field: string;
  reason: string;
  category?: string;
}

export interface QualityVerificationResult {
  isValidImage: boolean;
  fileOpensCorrectly: boolean;
  dimensionsValid: boolean;
  aspectRatioPreserved: boolean;
  noUnexpectedRotation: boolean;
  outputGenerated: boolean;
  metadataCleanupVerified: boolean;
  verifiedAt: string;
  
  // Specific category verifications
  dateTimeCleanupVerified?: boolean;
  cameraCleanupVerified?: boolean;
  makerNotesCleanupVerified?: boolean;
  uniqueIdsCleanupVerified?: boolean;
  thumbnailCleanupVerified?: boolean;
  orientationNormalized?: boolean;
  orientationTagRemoved?: boolean;
  gpsCleanupVerified?: boolean;
  iptcCleanupVerified?: boolean;
  xmpCleanupVerified?: boolean;
  faceRegionsCleanupVerified?: boolean;
  softwareHistoryCleanupVerified?: boolean;
  copyrightStatus?: 'preserved' | 'removed' | 'none';
  copyrightReason?: string;
  iccStatus?: 'preserved' | 'removed' | 'none';
  iccReason?: string;

  auditItems?: VerificationAuditItem[];
  retainedFieldWarnings?: RetainedFieldWarning[];

  retainedCameraFields?: string[];
  retainedGpsFields?: string[];
  retainedSensitiveFields?: string[];
  retainedIccFields?: string[];
  retainedExifFields?: string[];
  notes?: string[];
  warnings?: string[];
  sizeWarning?: string;
}

export interface CleanedImageItem {
  id: string;
  file: File;
  originalFile: {
    name: string;
    size: number;
    width: number;
    height: number;
    format: string;
    lastModified: number;
  };
  thumbnailUrl: string;
  objectUrl: string;
  
  status: CleanerProcessStatus;
  subSteps: StepProgressState;
  progress: number; // 0 to 100
  
  metadataBefore?: ParsedImageMetadata;
  metadataAfter?: ParsedImageMetadata;
  metadataDiff?: MetadataDiffReport;
  
  processedFile?: {
    name: string;
    blob: Blob;
    dataUrl: string;
    size: number;
    width: number;
    height: number;
    format: string;
    downloadUrl: string;
    reductionPercent: number;
  };
  
  verification?: QualityVerificationResult;
  warnings?: string[];
  error?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export type RenameMode = 'seo' | 'prefix' | 'random' | 'template';
export type OutputFormat = 'original' | 'jpeg' | 'png' | 'webp';
export type ResizeMode = 'original' | '1000x1500' | 'custom';

export interface ImageCleanerSettings {
  // Metadata Privacy
  removeGps: boolean;
  removeCamera: boolean;
  removeDateTime: boolean;
  removeMakerNotes: boolean;
  removeThumbnails: boolean;
  removeUniqueIds: boolean;
  removeIptcPersonal: boolean;
  removeXmpPersonal: boolean;
  removeFaceRegions: boolean;
  removeSoftwareHistory: boolean;
  removeCopyright: boolean; // Default false (preserve copyright unless requested)
  removeICCProfile: boolean; // Default false (preserve ICC unless requested)
  removeExif: boolean;

  // Image Normalization
  preserveAspectRatio: boolean;
  verifyOutput: boolean;
  normalizeOrientation: boolean;
  outputFormat: OutputFormat;
  jpegQuality: number; // 70 - 100
  resizeMode: ResizeMode;
  customWidth: number;
  customHeight: number;
  
  // Renaming
  enableRename: boolean;
  renameMode: RenameMode;
  keyword: string;
  prefix: string;
  template: string; // e.g. "{keyword}-{number}"
  startNumber: number;
  paddingDigits: number; // e.g. 3 -> "001"
  lowercase: boolean;
  sanitizeChars: boolean;
  
  // Queue & Concurrency
  concurrency: number; // 1 - 6
}

export const DEFAULT_CLEANER_SETTINGS: ImageCleanerSettings = {
  // Metadata Privacy (Exact defaults matching specifications)
  removeGps: true,
  removeCamera: true,
  removeDateTime: true,
  removeMakerNotes: true,
  removeThumbnails: true,
  removeUniqueIds: true,
  removeIptcPersonal: true,
  removeXmpPersonal: true,
  removeFaceRegions: true,
  removeSoftwareHistory: true,
  removeCopyright: false, // [ ] Remove copyright/contact metadata (Default unchecked)
  removeICCProfile: false, // [ ] Remove ICC / Color Profile (Default unchecked)
  removeExif: true,
  
  // Image Normalization
  preserveAspectRatio: true,
  verifyOutput: true,
  normalizeOrientation: true,
  outputFormat: 'original',
  jpegQuality: 92,
  resizeMode: 'original',
  customWidth: 1000,
  customHeight: 1500,
  
  // Renaming
  enableRename: true,
  renameMode: 'seo',
  keyword: 'pin-image',
  prefix: 'photo',
  template: '{keyword}-{number}',
  startNumber: 1,
  paddingDigits: 3,
  lowercase: true,
  sanitizeChars: true,
  
  concurrency: 3,
};

export const DEFAULT_IMAGE_CLEANER_SETTINGS = DEFAULT_CLEANER_SETTINGS;
