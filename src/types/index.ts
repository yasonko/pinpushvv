export type PinStatus = 'draft' | 'ready' | 'manual_required' | 'scheduled' | 'publishing' | 'published' | 'failed';

export type KeywordSource = 'pinterest' | 'cached' | 'taxonomy' | 'manual' | 'ai';
export type KeywordStatus = 'validated' | 'matched' | 'unverified' | 'invalid';

export interface PinKeywordDetail {
  value: string;               // Normalized clean keyword (e.g. "matcha latte")
  displayValue?: string;       // Readable display casing if different
  originalCandidate?: string;  // Original unverified candidate phrase if smart matched
  source: KeywordSource;       // 'pinterest' | 'cached' | 'taxonomy' | 'manual' | 'ai'
  status: KeywordStatus;       // 'validated' | 'matched' | 'unverified' | 'invalid'
  confidence: number;          // 0.0 to 1.0 (e.g. 1.0 = exact pinterest match, 0.85 = smart match, 0.4 = unverified AI)
  matchReason?: string;
  validatedAt?: string;
}

export interface KeywordValidationSummary {
  totalCandidates: number;
  validatedCount: number;
  matchedCount: number;
  manualCount: number;
  invalidCount: number;
  unverifiedCount: number;
  discardedCandidates?: Array<{ candidate: string; reason: string; replacedWith?: string }>;
  offlineFallbackUsed?: boolean;
}

export type AiStatus = 
  | 'waiting' 
  | 'analyzing' 
  | 'retrying' 
  | 'success' 
  | 'failed'
  | 'pending' 
  | 'processing' 
  | 'completed';

export type AiStep = 
  | 'idle'
  | 'waiting'
  | 'analyzing'
  | 'generating_title'
  | 'generating_description'
  | 'generating_tags'
  | 'generating_alt_text'
  | 'retrying'
  | 'saving'
  | 'waiting_cooldown'
  | 'completed'
  | 'success'
  | 'failed';

export interface Pin {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  mediaUrl?: string; // Publicly accessible HTTPS URL for Pinterest Bulk Upload
  title: string;
  description: string;
  altText: string;
  tags?: string[];
  keywordDetails?: PinKeywordDetail[];
  keywordSummary?: KeywordValidationSummary;
  destinationUrl: string;
  boardId?: string;
  websiteId?: string;
  status: PinStatus;
  
  // AI Metadata Tracking
  aiStatus: AiStatus;
  aiGenerated: boolean;
  titleManuallyEdited: boolean;
  descriptionManuallyEdited: boolean;
  tagsManuallyEdited: boolean;
  altTextManuallyEdited?: boolean;
  aiError?: string | null;
  aiProcessedAt?: string | null;
  aiCurrentStep?: AiStep;
  aiRetryAttempt?: number;
  aiProviderUsed?: 'groq' | 'openrouter' | 'gemini' | 'pollinations' | 'custom';
  aiStatusDetails?: string;
  aiCustomPrompt?: string; // Custom prompt/topic for AI to build title & description upon

  // Scheduling & Publishing
  scheduledAt: string | null; // ISO string
  publishedAt: string | null; // ISO string
  pinterestPinId?: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;

  // Dimensions & Aspect Ratio
  width?: number;
  height?: number;
  aspectRatio?: string;
  metrics?: {
    impressions: number;
    saves: number;
    outboundClicks: number;
    engagementRate: number;
  };
}

export interface Board {
  id: string;
  name: string;
  description?: string;
  pinterestBoardId?: string;
  privacy?: 'PUBLIC' | 'SECRET';
  pinCount?: number;
  createdAt: string;
}

export interface Website {
  id: string;
  name: string;
  url: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdAt: string;
}

export interface PinterestAccount {
  id?: string;
  accountId: string;
  username: string;
  profileImage?: string;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  isConnected: boolean;
  connectedAt?: string;
}

export type AiProviderType = 'groq' | 'openrouter' | 'auto' | 'gemini' | 'pollinations' | 'custom';

export interface AppSettings {
  timezone: string;
  defaultBoardId?: string;
  defaultWebsiteId?: string;
  defaultPublishingTimes: string[]; // e.g. ["09:00", "13:00", "18:00"]
  pinterestClientId?: string;
  pinterestClientSecret?: string;
  pinterestAccessToken?: string;
  autoScheduleIntervalDays: number;
  aiProvider?: AiProviderType;
  groqApiKey?: string;
  groqModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  customApiUrl?: string; // Custom API Endpoint URL
  customApiKey?: string; // Optional custom API key
  customApiModel?: string; // Optional custom model
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number; // ms
  timeout?: number; // ms
  aiModel?: string;
  aiLanguage?: string;
  autoStartAiOnUpload?: boolean;
  aiMinDelaySeconds?: number;
  aiMaxDelaySeconds?: number;
  aiCustomPrompt?: string; // Persistent default prompt/instructions for AI metadata generation
}

export type ActiveTab = 
  | 'dashboard'
  | 'assistant'
  | 'upload'
  | 'ebook'
  | 'cleaner'
  | 'watermark'
  | 'library'
  | 'schedule'
  | 'analytics'
  | 'websites'
  | 'boards'
  | 'settings';

export interface PublishQueueItem {
  id: string;
  pinId: string;
  filename?: string;
  thumbnailUrl?: string;
  title?: string;
  boardName?: string;
  status: 'queued' | 'publishing' | 'completed' | 'success' | 'failed';
  attempts?: number;
  scheduledTime?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  lastAttemptAt?: string;
  error?: string | null;
}

export interface AiQueueState {
  isRunning: boolean;
  isPaused: boolean;
  currentPinId: string | null;
  currentFilename: string | null;
  currentStep: AiStep;
  currentProvider?: AiProviderType;
  currentRetryAttempt?: number;
  processedCount: number;
  totalCount: number;
  successCount: number;
  failedCount: number;
  waitingCountdown: number;
  cooldownDuration: number;
  queue: string[];
}
