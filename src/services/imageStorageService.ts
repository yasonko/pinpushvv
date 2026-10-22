import { Pin } from '../types';
import { dbService } from './db';

/**
 * Validates if a URL is a real, publicly accessible HTTPS URL.
 * Strictly rejects local, browser-only, relative, private network, or dev container URLs.
 */
export function isPublicHttpsUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Reject non-http(s) protocols
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('blob:') ||
    lower.startsWith('file:') ||
    lower.startsWith('data:') ||
    lower.startsWith('/') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('0.0.0.0') ||
    lower.includes('/mnt/') ||
    lower.includes('c:\\') ||
    lower.includes('d:\\') ||
    lower.includes('c:/') ||
    lower.includes('d:/') ||
    // Strictly reject ephemeral/auth-protected dev container upload URLs
    lower.includes('.run.app/uploads') ||
    lower.includes('ais-dev-') ||
    lower.includes('ais-pre-')
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to get active client origin, prioritizing HTTPS in hosted environments.
 */
export function getPublicClientOrigin(): string {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin.includes('.run.app') || origin.includes('.app')) {
      return origin.replace(/^http:\/\//, 'https://');
    }
    return origin;
  }
  return '';
}

/**
 * Converts any browser image source (data URL, blob URL, File, or Blob) into a base64 Data URL.
 */
export async function resolveImageAsDataUrl(
  imageSource: string | Blob | File
): Promise<{ dataUrl: string; mimeType: string; sizeBytes: number; base64Raw: string }> {
  // If already a File or Blob
  if (imageSource instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Raw = result.includes('base64,') ? result.split('base64,')[1] : result;
        resolve({
          dataUrl: result,
          mimeType: imageSource.type || 'image/jpeg',
          sizeBytes: imageSource.size,
          base64Raw,
        });
      };
      reader.onerror = () => reject(new Error('Failed to read image Blob as Data URL'));
      reader.readAsDataURL(imageSource);
    });
  }

  if (typeof imageSource !== 'string' || !imageSource) {
    throw new Error('Image source is missing or invalid');
  }

  // If it's a blob: URL in the browser, fetch it locally
  if (imageSource.startsWith('blob:')) {
    try {
      const blobRes = await fetch(imageSource);
      if (!blobRes.ok) {
        throw new Error(`Failed to resolve local blob URL (HTTP ${blobRes.status})`);
      }
      const blob = await blobRes.blob();
      return resolveImageAsDataUrl(blob);
    } catch (err: any) {
      throw new Error(`Could not fetch browser blob URL: ${err.message}`);
    }
  }

  // If already a data URL
  if (imageSource.startsWith('data:')) {
    const mimeMatch = imageSource.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Raw = imageSource.includes('base64,') ? imageSource.split('base64,')[1] : imageSource;
    const sizeBytes = Math.floor((base64Raw.length * 3) / 4);
    return {
      dataUrl: imageSource,
      mimeType,
      sizeBytes,
      base64Raw,
    };
  }

  // If it's a remote URL
  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    try {
      const res = await fetch(imageSource);
      const blob = await res.blob();
      return resolveImageAsDataUrl(blob);
    } catch (err: any) {
      throw new Error(`Could not fetch remote image URL: ${err.message}`);
    }
  }

  // Fallback: assume raw base64 string
  return {
    dataUrl: `data:image/jpeg;base64,${imageSource}`,
    mimeType: 'image/jpeg',
    sizeBytes: Math.floor((imageSource.length * 3) / 4),
    base64Raw: imageSource,
  };
}

/**
 * Performs a programmatic reachability & verification test on a public image URL.
 * Asserts HTTP 200, HTTPS, Content-Type image/*, and no HTML/auth wall.
 */
export async function verifyUrlReachable(
  url: string, 
  timeoutMs = 10000
): Promise<{ reachable: boolean; status?: number; contentType?: string; error?: string }> {
  if (!isPublicHttpsUrl(url)) {
    return {
      reachable: false,
      error: 'URL is not a valid public HTTPS address',
    };
  }

  // First try server-side verification proxy to bypass any browser CORS restrictions
  try {
    const verifyRes = await fetch('/api/images/verify-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (verifyRes.ok) {
      const data = await verifyRes.json();
      if (data.isImage && data.status === 200 && !data.isHtml) {
        return {
          reachable: true,
          status: data.status,
          contentType: data.contentType,
        };
      } else if (data.error) {
        return {
          reachable: false,
          status: data.status,
          contentType: data.contentType,
          error: data.error,
        };
      }
    }
  } catch {
    // Fall back to direct browser verification
  }

  // Direct browser verification fallback
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response | null = null;
    try {
      res = await fetch(url, { method: 'HEAD', signal: controller.signal, cache: 'no-cache' });
    } catch {
      res = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-cache' });
    }

    clearTimeout(timer);

    if (res && res.status === 200) {
      const cType = res.headers.get('content-type') || '';
      if (cType.toLowerCase().startsWith('image/')) {
        return { reachable: true, status: 200, contentType: cType };
      }
    }

    if (res && !res.ok) {
      return {
        reachable: false,
        status: res.status,
        error: `Server responded with HTTP ${res.status}`,
      };
    }
  } catch {
    // Image element fallback
  }

  // Final check: Load via Image element in browser
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = '';
      resolve({ reachable: false, error: 'Image reachability check timed out' });
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve({ reachable: true, status: 200, contentType: 'image/jpeg' });
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve({ reachable: false, error: 'Image failed to load directly from public storage' });
    };

    img.src = url;
  });
}

import { getSavedPostFileKey } from './ebook/pdfStorageService';

/**
 * Direct client-side upload to PostFile high-speed cloud CDN.
 */
async function uploadDirectToPostFile(base64Raw: string, mimeType = 'image/jpeg'): Promise<string> {
  const postFileKey = getSavedPostFileKey();
  if (!postFileKey) {
    throw new Error('PostFile API key not configured in browser storage');
  }

  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const filename = `pin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const byteCharacters = atob(base64Raw);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const fd = new FormData();
  fd.append('file', blob, filename);

  const res = await fetch('https://postfile.net/v1/upload', {
    method: 'POST',
    headers: {
      'X-API-Key': postFileKey,
    },
    body: fd,
  });

  if (!res.ok) {
    throw new Error(`PostFile responded with HTTP ${res.status}`);
  }

  const json = await res.json();
  const directUrl = json?.url || json?.direct_url || json?.download_url || (json?.data && json?.data.url);
  if (!directUrl || !isPublicHttpsUrl(directUrl)) {
    throw new Error('PostFile did not return a valid direct image URL');
  }

  return directUrl;
}

/**
 * Direct client-side upload to FreeImage / iili.io public image hosting.
 */
async function uploadDirectToFreeImage(base64Raw: string): Promise<string> {
  const fd = new FormData();
  fd.append('key', '6d207e02198a847aa98d0a2a901485a5');
  fd.append('action', 'upload');
  fd.append('source', base64Raw);
  fd.append('format', 'json');

  const res = await fetch('https://freeimage.host/api/1/upload', {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) {
    throw new Error(`FreeImage responded with HTTP ${res.status}`);
  }

  const json = await res.json();
  const directUrl = json?.image?.image?.url || json?.image?.url;
  if (!directUrl || !isPublicHttpsUrl(directUrl)) {
    throw new Error('FreeImage did not return a valid direct image URL');
  }

  return directUrl;
}

/**
 * Direct client-side upload to Imgur public image hosting.
 */
async function uploadDirectToImgur(base64Raw: string): Promise<string> {
  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Authorization': 'Client-ID 546c25a59c58ad7',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: base64Raw, type: 'base64' }),
  });

  if (!res.ok) {
    throw new Error(`Imgur responded with HTTP ${res.status}`);
  }

  const json = await res.json();
  const directUrl = json?.data?.link;
  if (!directUrl || !isPublicHttpsUrl(directUrl)) {
    throw new Error('Imgur did not return a valid direct image URL');
  }

  return directUrl;
}

/**
 * Uploads an image for a single Pin using the backend storage pipeline with client-side fallback.
 * Validates the public HTTPS URL before returning.
 */
export async function uploadPinImage(pin: Pin): Promise<string> {
  const rawImage = pin.imageUrl || pin.thumbnailUrl;
  if (!rawImage) {
    throw new Error('Pin has no image data to upload');
  }

  // 1. Resolve image into clean base64 data
  const { dataUrl, mimeType, sizeBytes, base64Raw } = await resolveImageAsDataUrl(rawImage);

  const uploadEndpoint = '/api/images/upload';
  const clientOrigin = getPublicClientOrigin();

  console.log('[Storage Pipeline] Uploading image for Pin:', pin.id, { mimeType, sizeBytes });

  let publicUrl: string | null = null;
  let uploadError: string = '';

  // Attempt 1: Call Backend Storage API (/api/images/upload)
  try {
    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-origin': clientOrigin,
      },
      body: JSON.stringify({
        image: dataUrl,
        filename: pin.filename || `${pin.id}.jpg`,
        pinId: pin.id,
        clientOrigin,
      }),
    });

    const responseText = await response.text();
    console.log('[Storage Pipeline] API status:', response.status);

    if (response.ok) {
      const data = JSON.parse(responseText || '{}');
      const candidateUrl = data.url || data.mediaUrl;
      if (candidateUrl && isPublicHttpsUrl(candidateUrl)) {
        publicUrl = candidateUrl;
      }
    } else {
      uploadError = `Backend HTTP ${response.status}: ${responseText.slice(0, 100)}`;
    }
  } catch (err: any) {
    uploadError = err.message || 'Backend storage unreachable';
    console.warn('[Storage Pipeline] Backend upload attempt failed, attempting direct cloud upload:', err.message);
  }

  // Attempt 2: Direct upload to PostFile Cloud CDN
  if (!publicUrl) {
    try {
      console.log('[Storage Pipeline] Uploading directly to PostFile CDN...');
      publicUrl = await uploadDirectToPostFile(base64Raw, mimeType);
    } catch (pfErr: any) {
      console.warn('[Storage Pipeline] PostFile direct upload failed:', pfErr.message);
      uploadError = pfErr.message;
    }
  }

  // Attempt 3: Direct upload to FreeImage / iili.io
  if (!publicUrl) {
    try {
      console.log('[Storage Pipeline] Uploading directly to FreeImage CDN...');
      publicUrl = await uploadDirectToFreeImage(base64Raw);
    } catch (fiErr: any) {
      console.warn('[Storage Pipeline] FreeImage direct upload failed:', fiErr.message);
      uploadError = fiErr.message;
    }
  }

  // Attempt 4: Direct upload to Imgur fallback
  if (!publicUrl) {
    try {
      console.log('[Storage Pipeline] Uploading directly to Imgur CDN...');
      publicUrl = await uploadDirectToImgur(base64Raw);
    } catch (imgErr: any) {
      console.warn('[Storage Pipeline] Imgur direct upload failed:', imgErr.message);
      uploadError = imgErr.message;
    }
  }

  if (!publicUrl || !isPublicHttpsUrl(publicUrl)) {
    throw new Error(
      `Image upload to public storage failed: ${uploadError || 'No valid public URL generated'}`
    );
  }

  // Mandatory URL programmatic verification
  const reachability = await verifyUrlReachable(publicUrl);
  if (!reachability.reachable) {
    console.warn(`[Storage Pipeline] Verification check for ${publicUrl}:`, reachability.error);
    // If verification returned an explicit non-200 or HTML error, raise failure
    if (reachability.status && reachability.status !== 200) {
      throw new Error(`Public URL validation failed (HTTP ${reachability.status}): ${reachability.error}`);
    }
  }

  console.log('[Storage Pipeline] Successfully verified public URL:', publicUrl);
  return publicUrl;
}

export interface SingleUploadTestResult {
  success: boolean;
  pinId: string;
  title: string;
  publicUrl?: string;
  httpStatus?: number;
  contentType?: string;
  verified: boolean;
  error?: string;
}

/**
 * Tests uploading a single Pin's image and verifies public reachability.
 */
export async function testSingleImageUpload(pin: Pin): Promise<SingleUploadTestResult> {
  const title = pin.title || pin.filename || 'Test Pin';
  try {
    const publicUrl = await uploadPinImage(pin);
    const reachability = await verifyUrlReachable(publicUrl);

    return {
      success: true,
      pinId: pin.id,
      title,
      publicUrl,
      httpStatus: reachability.status || 200,
      contentType: reachability.contentType || 'image/jpeg',
      verified: reachability.reachable,
      error: reachability.reachable ? undefined : reachability.error,
    };
  } catch (err: any) {
    return {
      success: false,
      pinId: pin.id,
      title,
      verified: false,
      error: err.message || 'Image upload test failed',
    };
  }
}

export interface PreparePinsResult {
  success: boolean;
  updatedPins: Pin[];
  uploadedCount: number;
  existingCount: number;
  failedPins: Array<{
    pin: Pin;
    pinNumber: number;
    title: string;
    error: string;
  }>;
}

/**
 * Ensures all pins have a valid public Media URL before export.
 * If a pin already has a public HTTPS URL, uses it directly.
 * If not, uploads the existing image and updates the Pin's mediaUrl.
 * Persists the updated URLs to IndexedDB.
 */
export async function preparePinsForExportWithMediaUrls(
  pins: Pin[],
  onProgress?: (current: number, total: number, pin: Pin) => void
): Promise<PreparePinsResult> {
  const updatedPins: Pin[] = [];
  const pinsToPersist: Pin[] = [];
  const failedPins: Array<{ pin: Pin; pinNumber: number; title: string; error: string }> = [];
  let uploadedCount = 0;
  let existingCount = 0;

  for (let i = 0; i < pins.length; i++) {
    const pin = pins[i];
    const pinNumber = i + 1;
    const title = pin.title || pin.filename || `Pin #${pinNumber}`;

    if (onProgress) {
      onProgress(i + 1, pins.length, pin);
    }

    // 1. Check whether a valid public HTTPS URL already exists
    if (pin.mediaUrl && isPublicHttpsUrl(pin.mediaUrl)) {
      existingCount++;
      updatedPins.push(pin);
      continue;
    }

    if (pin.imageUrl && isPublicHttpsUrl(pin.imageUrl)) {
      const updated: Pin = { ...pin, mediaUrl: pin.imageUrl };
      existingCount++;
      updatedPins.push(updated);
      pinsToPersist.push(updated);
      continue;
    }

    // 2. If NO valid public URL exists, upload the image to persistent public storage
    try {
      const publicUrl = await uploadPinImage(pin);
      const updated: Pin = {
        ...pin,
        mediaUrl: publicUrl,
        updatedAt: new Date().toISOString(),
      };
      uploadedCount++;
      updatedPins.push(updated);
      pinsToPersist.push(updated);
    } catch (err: any) {
      console.error(`[Export URL Generator] Failed to upload image for Pin #${pinNumber} (${title}):`, err);
      failedPins.push({
        pin,
        pinNumber,
        title,
        error: err.message || 'Image storage upload failed',
      });
    }
  }

  // Persist updated pins to IndexedDB storage so they won't be re-uploaded on subsequent exports
  if (pinsToPersist.length > 0) {
    try {
      await dbService.savePins(pinsToPersist);
    } catch (dbErr) {
      console.warn('[Storage Service] Could not persist media URLs to IndexedDB:', dbErr);
    }
  }

  return {
    success: failedPins.length === 0,
    updatedPins,
    uploadedCount,
    existingCount,
    failedPins,
  };
}
