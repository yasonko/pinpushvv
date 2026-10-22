export type WatermarkSourceType = 'image' | 'text';

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'tiled';

export type WatermarkBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light';

export type WatermarkOutputFormat = 'png' | 'jpeg' | 'webp';

export interface WatermarkSettings {
  // Source
  sourceType: WatermarkSourceType;
  watermarkDataUrl: string | null;
  watermarkFilename: string;
  text: string;
  fontFamily: string;
  textColor: string;
  isBold: boolean;
  isItalic: boolean;

  // Placement & Geometry
  position: WatermarkPosition;
  scalePercent: number; // 5 to 80 % of host image width
  opacity: number; // 0.05 to 1.0
  rotation: number; // -180 to 180 degrees
  paddingPercent: number; // 0 to 15 % from image edges

  // Tiled Pattern Settings (when position === 'tiled')
  tileSpacingPercent: number; // 15 to 60 %
  tileAngle: number; // default -30 deg

  // Effects & Visual Style
  blendMode: WatermarkBlendMode;
  useShadow: boolean;
  shadowColor: string;
  useBgPill: boolean;
  bgPillColor: string;
  bgPillRadius: number;

  // Output
  outputFormat: WatermarkOutputFormat;
  outputQuality: number; // 0.8 to 1.0 (for jpg/webp)
  filenameSuffix: string;
}

export interface WatermarkItem {
  id: string;
  name: string;
  file?: File;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
  originalSizeBytes: number;
  originalFormat: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  watermarkedUrl?: string;
  watermarkedBlob?: Blob;
  watermarkedSizeBytes?: number;
  error?: string;
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  sourceType: 'image',
  watermarkDataUrl: null,
  watermarkFilename: 'watermark.png',
  text: '© PinPulse Studio',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  textColor: '#ffffff',
  isBold: true,
  isItalic: false,
  position: 'bottom-right',
  scalePercent: 22,
  opacity: 0.85,
  rotation: 0,
  paddingPercent: 4,
  tileSpacingPercent: 30,
  tileAngle: -30,
  blendMode: 'normal',
  useShadow: true,
  shadowColor: 'rgba(0, 0, 0, 0.65)',
  useBgPill: false,
  bgPillColor: 'rgba(0, 0, 0, 0.45)',
  bgPillRadius: 8,
  outputFormat: 'png',
  outputQuality: 0.95,
  filenameSuffix: '_watermarked',
};
