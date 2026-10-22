/**
 * Extension Bridge Service
 * Handles communication between PinPulse Web App and the Copy to Pinterest Assistant Extension.
 * Generates dynamic .ZIP downloads and provides single & batch queue syncing with clipboard fallbacks.
 */
import JSZip from 'jszip';
import { Pin } from '../types';

import { extensionManifest } from './extensionSource/manifest';
import { backgroundJs } from './extensionSource/background';
import { pinterestSelectorsJs } from './extensionSource/pinterestSelectors';
import { pinterestDetectorJs } from './extensionSource/pinterestDetector';
import { pinterestFillerJs } from './extensionSource/pinterestFiller';
import { contentJs } from './extensionSource/content';
import { stylesCss } from './extensionSource/styles';
import { popupHtml } from './extensionSource/popupHtml';
import { popupJs } from './extensionSource/popupJs';
import { readmeMd } from './extensionSource/readme';
import { iconBase64Map } from './extensionSource/iconsBase64';

const STORAGE_KEY_EXTENSION_ID = 'pinterest_assistant_extension_id';

export interface PinDataPayload {
  type: 'PIN_DATA';
  pinId: string;
  image: string;
  imageUrl: string;
  title: string;
  description: string;
  url: string;
  destinationUrl?: string;
  tags: string[];
  board: string;
  boardId?: string;
  altText: string;
  timestamp: number;
}

export interface PinQueuePayload {
  type: 'PIN_QUEUE';
  queueIndex: number;
  total: number;
  pins: PinDataPayload[];
  timestamp: number;
}

export interface CopyToExtensionResult {
  success: boolean;
  mode: 'direct' | 'clipboard';
  message: string;
  pinId?: string;
  payload?: PinDataPayload | PinQueuePayload;
}

export function getExtensionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_EXTENSION_ID) || null;
}

export function setExtensionId(id?: string | null): void {
  if (typeof window === 'undefined') return;
  const clean = (id || '').trim();
  if (clean) {
    localStorage.setItem(STORAGE_KEY_EXTENSION_ID, clean);
  } else {
    localStorage.removeItem(STORAGE_KEY_EXTENSION_ID);
  }
}

/**
 * Check if the Chrome extension is connected via direct message ping
 */
export async function checkExtensionConnection(customExtensionId?: string): Promise<{ connected: boolean; version?: string; activePinId?: string }> {
  const extensionId = customExtensionId || getExtensionId();
  const chromeRuntime = (typeof window !== 'undefined' && (window as any).chrome?.runtime) ? (window as any).chrome.runtime : null;

  if (!extensionId || !chromeRuntime || typeof chromeRuntime.sendMessage !== 'function') {
    return { connected: false };
  }

  return new Promise((resolve) => {
    try {
      chromeRuntime.sendMessage(
        extensionId,
        { type: 'PING_PINTEREST_ASSISTANT', timestamp: Date.now() },
        (response: any) => {
          if (chromeRuntime.lastError) {
            resolve({ connected: false });
          } else if (response && response.type === 'PONG') {
            resolve({
              connected: true,
              version: response.version,
              activePinId: response.activePinId
            });
          } else {
            resolve({ connected: false });
          }
        }
      );
    } catch (e) {
      resolve({ connected: false });
    }
  });
}

export async function checkExtensionInstalled(): Promise<boolean> {
  const result = await checkExtensionConnection();
  return result.connected;
}

/**
 * Send full queue of pins to the extension (for batch 1-click publishing)
 */
export async function copyQueueToExtension(
  pins: Pin[],
  boards: { id: string; name: string }[] = []
): Promise<CopyToExtensionResult> {
  const boardMap = new Map(boards.map(b => [b.id, b.name]));

  const queueItems: PinDataPayload[] = pins.map((p, idx) => ({
    type: 'PIN_DATA',
    pinId: String(p.id || idx + 1),
    image: p.imageUrl || '',
    imageUrl: p.imageUrl || '',
    title: (p.title || p.filename || '').trim(),
    description: (p.description || '').trim(),
    url: (p.destinationUrl || '').trim(),
    destinationUrl: (p.destinationUrl || '').trim(),
    tags: Array.isArray(p.tags) ? p.tags : [],
    board: (p.boardId ? boardMap.get(p.boardId) || '' : '').trim(),
    altText: (p.altText || p.title || p.filename || '').trim(),
    timestamp: Date.now()
  }));

  const payload: PinQueuePayload = {
    type: 'PIN_QUEUE',
    queueIndex: 0,
    total: queueItems.length,
    pins: queueItems,
    timestamp: Date.now()
  };

  const jsonString = JSON.stringify(payload, null, 2);

  // 1. Copy to Clipboard
  let clipboardCopied = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(jsonString);
      clipboardCopied = true;
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }

  // 2. Save to localStorage
  try {
    localStorage.setItem('active_pinterest_queue', jsonString);
    if (queueItems[0]) {
      const firstPinJson = JSON.stringify(queueItems[0]);
      localStorage.setItem('active_pinterest_pin', firstPinJson);
      localStorage.setItem('activePin', firstPinJson);
    }
  } catch (e) {}

  // 3. Direct Chrome runtime message
  const extensionId = getExtensionId();
  const chromeRuntime = (typeof window !== 'undefined' && (window as any).chrome?.runtime) ? (window as any).chrome.runtime : null;

  if (extensionId && chromeRuntime && typeof chromeRuntime.sendMessage === 'function') {
    try {
      const directResponse = await new Promise<any>((resolve) => {
        chromeRuntime.sendMessage(extensionId, payload, (res: any) => {
          if (chromeRuntime.lastError) {
            resolve({ success: false, error: chromeRuntime.lastError.message });
          } else {
            resolve({ success: true, response: res });
          }
        });
      });

      if (directResponse.success) {
        return {
          success: true,
          mode: 'direct',
          message: `✓ Sent ${queueItems.length} Pins to Pinterest Assistant Queue`,
          payload
        };
      }
    } catch (e) {}
  }

  return {
    success: true,
    mode: 'clipboard',
    message: clipboardCopied
      ? `✓ Batch of ${queueItems.length} Pins copied! Open Pinterest and click [ IMPORT FROM CLIPBOARD ]`
      : `✓ ${queueItems.length} Pins prepared for extension.`,
    payload
  };
}

/**
 * Copy single pin to extension
 */
export async function copyPinToExtension(
  pin: Pin, 
  boardName?: string
): Promise<CopyToExtensionResult> {
  const payload: PinDataPayload = {
    type: 'PIN_DATA',
    pinId: String(pin.id),
    image: pin.imageUrl || '',
    imageUrl: pin.imageUrl || '',
    title: (pin.title || pin.filename || '').trim(),
    description: (pin.description || '').trim(),
    url: (pin.destinationUrl || '').trim(),
    tags: Array.isArray(pin.tags) ? pin.tags : [],
    board: (boardName || '').trim(),
    altText: (pin.altText || pin.title || pin.filename || '').trim(),
    timestamp: Date.now()
  };

  const jsonString = JSON.stringify(payload, null, 2);

  // 1. Copy JSON to Clipboard
  let clipboardCopied = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(jsonString);
      clipboardCopied = true;
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }

  // 2. Save to localStorage
  try {
    localStorage.setItem('active_pinterest_pin', jsonString);
    localStorage.setItem('activePin', jsonString);
  } catch (e) {}

  // 3. Direct message if connected
  const extensionId = getExtensionId();
  const chromeRuntime = (typeof window !== 'undefined' && (window as any).chrome?.runtime) ? (window as any).chrome.runtime : null;

  if (extensionId && chromeRuntime && typeof chromeRuntime.sendMessage === 'function') {
    try {
      const directResponse = await new Promise<any>((resolve) => {
        chromeRuntime.sendMessage(extensionId, payload, (res: any) => {
          if (chromeRuntime.lastError) {
            resolve({ success: false, error: chromeRuntime.lastError.message });
          } else {
            resolve({ success: true, response: res });
          }
        });
      });

      if (directResponse.success) {
        return {
          success: true,
          mode: 'direct',
          message: '✓ Sent to Pinterest Assistant',
          pinId: String(pin.id),
          payload
        };
      }
    } catch (e) {}
  }

  return {
    success: true,
    mode: 'clipboard',
    message: clipboardCopied 
      ? '✓ Pin copied! Open Pinterest and click [ IMPORT FROM CLIPBOARD ]'
      : '✓ Pin prepared! Open Pinterest and paste details.',
    pinId: String(pin.id),
    payload
  };
}

/**
 * Legacy compatibility alias
 */
export async function sendPinToExtension(
  pin: Pin, 
  boardName?: string
): Promise<{ success: boolean; error?: string; pinId?: string }> {
  const res = await copyPinToExtension(pin, boardName);
  return { success: res.success, pinId: res.pinId };
}

/**
 * Open Pinterest Pin Creation page and prepare the current pin
 */
export async function openPinterestWithAssistant(pin: Pin, boardName?: string) {
  try {
    await copyPinToExtension(pin, boardName);
  } catch (err) {
    console.warn('copyPinToExtension error before opening:', err);
  }
  const pinBuilderUrl = 'https://www.pinterest.com/pin-builder/';
  try {
    const win = window.open(pinBuilderUrl, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const a = document.createElement('a');
      a.href = pinBuilderUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('Failed to open Pinterest window:', err);
  }
}

/**
 * Generate and download the Chrome Extension files as a single .ZIP package
 */
export async function downloadExtensionZip(): Promise<void> {
  const zip = new JSZip();

  zip.file("manifest.json", JSON.stringify(extensionManifest, null, 2));
  zip.file("background.js", backgroundJs);
  zip.file("pinterestSelectors.js", pinterestSelectorsJs);
  zip.file("pinterestDetector.js", pinterestDetectorJs);
  zip.file("pinterestFiller.js", pinterestFillerJs);
  zip.file("content.js", contentJs);
  zip.file("styles.css", stylesCss);
  zip.file("popup.html", popupHtml);
  zip.file("popup.js", popupJs);
  zip.file("README.md", readmeMd);

  // Add icon assets
  if (iconBase64Map[16]) {
    zip.file("icons/icon16.png", iconBase64Map[16], { base64: true });
  }
  if (iconBase64Map[48]) {
    zip.file("icons/icon48.png", iconBase64Map[48], { base64: true });
  }
  if (iconBase64Map[128]) {
    zip.file("icons/icon128.png", iconBase64Map[128], { base64: true });
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'copy-to-pinterest-assistant-extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}
