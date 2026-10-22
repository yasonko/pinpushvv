export interface PinDataPayload {
  type: 'PIN_DATA';
  pinId: string;
  image?: string;
  imageUrl?: string;
  title: string;
  description: string;
  url: string;
  tags: string[];
  board: string;
  altText?: string;
  timestamp?: number;
}

export interface PinReadyPayload {
  type: 'PIN_READY';
  pinId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  title: string;
  description: string;
  destinationUrl: string;
  tags: string[];
  board?: string;
  boardId?: string;
  altText?: string;
  timestamp: number;
}

export type ExtensionState = 
  | 'WAITING_FOR_PINTEREST'
  | 'PIN_PAGE_DETECTED'
  | 'FILLING'
  | 'READY_FOR_REVIEW'
  | 'ERROR';

export interface ExtensionStatusMessage {
  type: 'EXTENSION_STATUS';
  state: ExtensionState;
  pinId?: string;
  pinTitle?: string;
  message?: string;
  timestamp: number;
}

export interface PingMessage {
  type: 'PING' | 'PING_PINTEREST_ASSISTANT';
  timestamp?: number;
}

export interface PongMessage {
  success?: boolean;
  type: 'PONG' | 'PONG_PINTEREST_ASSISTANT';
  extensionVersion?: string;
  version?: string;
  status?: 'ready' | 'active';
  activePinId?: string | null;
  timestamp?: number;
}

export interface PinReceivedMessage {
  success: boolean;
  type: 'PIN_RECEIVED';
  pinId: string;
  stored?: boolean;
  timestamp?: number;
}

export interface PinPublishedAckMessage {
  type: 'PIN_PUBLISHED_ACK';
  pinId: string;
  timestamp: number;
}

export interface RequestNextPinMessage {
  type: 'REQUEST_NEXT_PIN';
  currentPinId: string;
  timestamp: number;
}

export type ExtensionErrorType = 
  | 'ID_MISSING' 
  | 'CHROME_UNAVAILABLE' 
  | 'NOT_INSTALLED' 
  | 'ORIGIN_NOT_ALLOWED' 
  | 'TIMEOUT' 
  | 'UNKNOWN_ERROR';

export interface ExtensionConnectionResult {
  connected: boolean;
  version?: string;
  extensionId?: string;
  errorType?: ExtensionErrorType;
  errorMessage?: string;
  rawError?: string;
  roundTripMs?: number;
  activePinId?: string | null;
  timestamp: number;
}

export type AppToExtensionMessage = 
  | PinReadyPayload
  | PingMessage
  | RequestNextPinMessage;

export type ExtensionToAppMessage = 
  | PongMessage
  | PinReceivedMessage
  | ExtensionStatusMessage
  | PinPublishedAckMessage;
