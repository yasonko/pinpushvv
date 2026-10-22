import { StorageConfig, StorageProviderType } from '../../types/ebook';
import { StorageUploadResult, UrlVerificationResult } from './storage/StorageProvider';
import { createStorageProvider, isStorageConfigured, SUPPORTED_STORAGE_PROVIDERS } from './storage/StorageFactory';

export type { StorageUploadResult, UrlVerificationResult, StorageConfig, StorageProviderType };
export { SUPPORTED_STORAGE_PROVIDERS, isStorageConfigured };

const STORAGE_SETTINGS_KEY = 'pinpulse_pdf_storage_settings';
export const POSTFILE_API_KEY_STORAGE_KEY = 'pinpulse_postfile_api_key';

/**
 * Retrieves the user's PostFile API key saved in browser localStorage only.
 */
export function getSavedPostFileKey(): string {
  try {
    const directKey = localStorage.getItem(POSTFILE_API_KEY_STORAGE_KEY);
    if (directKey && directKey.trim()) {
      return directKey.trim();
    }
    const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.postfile?.apiKey) {
        return parsed.postfile.apiKey.trim();
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return '';
}

/**
 * Saves the user's PostFile API key into browser localStorage only.
 */
export function savePostFileKey(key: string): void {
  try {
    const cleanKey = (key || '').trim();
    if (cleanKey) {
      localStorage.setItem(POSTFILE_API_KEY_STORAGE_KEY, cleanKey);
    } else {
      localStorage.removeItem(POSTFILE_API_KEY_STORAGE_KEY);
    }
    const config = getSavedStorageConfig();
    config.postfile = { apiKey: cleanKey };
    saveStorageConfig(config);
  } catch (err) {
    console.warn('[PDF Storage] Failed to save PostFile key to localStorage:', err);
  }
}

/**
 * Get stored or default PDF Storage configuration from browser localStorage.
 */
export function getSavedStorageConfig(): StorageConfig {
  const localKey = getSavedPostFileKey();

  try {
    const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.provider) {
        if (!parsed.postfile) {
          parsed.postfile = { apiKey: localKey };
        } else if (!parsed.postfile.apiKey && localKey) {
          parsed.postfile.apiKey = localKey;
        }
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage errors
  }

  return {
    provider: 'postfile',
    postfile: {
      apiKey: localKey,
    },
  };
}

/**
 * Save PDF Storage configuration to localStorage
 */
export function saveStorageConfig(config: StorageConfig): void {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('[PDF Storage] Failed to save storage config to localStorage:', err);
  }
}

/**
 * Convert a Blob to Base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Strictly verifies if a URL is a real, public, permanent HTTPS download link.
 * Strictly rejects:
 * - blob: / data: / file:
 * - localhost / 127.0.0.1 / 0.0.0.0
 * - *.run.app (dev container / reverse proxy URLs that require AI Studio authentication cookies)
 * - relative paths
 */
export function isRealPublicPdfUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Must have a valid protocol
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('blob:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('/') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('0.0.0.0') ||
    // Strictly reject ephemeral or auth-gated dev container URLs
    lower.includes('.run.app') ||
    lower.includes('ais-dev-') ||
    lower.includes('ais-pre-') ||
    lower.includes('__cookie_check')
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
 * Performs a rigorous programmatic reachability & verification test on a public PDF URL.
 * Asserts:
 * - HTTP status 200/206
 * - Valid public HTTPS address
 * - Not a redirect to login / cookie check (__cookie_check.html)
 * - Content-Type is PDF or binary (not text/html)
 */
export async function verifyPublicPdfUrl(url: string, timeoutMs = 12000): Promise<UrlVerificationResult> {
  if (!url || typeof url !== 'string') {
    return { reachable: false, status: 0, isPdf: false, isHttps: false, error: 'Empty URL provided' };
  }

  if (!isRealPublicPdfUrl(url)) {
    return {
      reachable: false,
      status: 0,
      isPdf: false,
      isHttps: false,
      error: 'URL is not a valid public HTTPS URL (cannot use local, blob, or dev container run.app URLs)',
    };
  }

  // 1. Try server verification proxy to test reachability from an independent server
  try {
    const res = await fetch('/api/storage/pdf/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.reachable && data.isPdf && !data.isHtml) {
        return {
          reachable: true,
          status: data.status || 200,
          contentType: data.contentType,
          contentLength: data.contentLength,
          isPdf: true,
          isHttps: true,
        };
      } else {
        return {
          reachable: false,
          status: data.status || 0,
          contentType: data.contentType,
          isPdf: false,
          isHttps: true,
          error: data.error || 'Server reported URL does not return a direct public PDF stream',
        };
      }
    }
  } catch {
    // Fallback to direct client verification check
  }

  // 2. Direct client verification check
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

    if (res) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isHtml = contentType.includes('text/html') || contentType.includes('text/plain');
      const isPdf =
        contentType.includes('application/pdf') ||
        contentType.includes('application/octet-stream') ||
        contentType.includes('binary/octet-stream') ||
        url.toLowerCase().endsWith('.pdf');

      if ((res.status === 200 || res.status === 206) && isPdf && !isHtml) {
        return {
          reachable: true,
          status: res.status,
          contentType,
          contentLength: Number(res.headers.get('content-length')) || undefined,
          isPdf: true,
          isHttps: url.startsWith('https://'),
        };
      }

      return {
        reachable: false,
        status: res.status,
        contentType,
        isPdf: false,
        isHttps: url.startsWith('https://'),
        error: isHtml
          ? 'URL returned an HTML web page instead of raw PDF bytes (may require login/cookies)'
          : `HTTP ${res.status} returned with Content-Type: ${contentType}`,
      };
    }
  } catch (err: any) {
    return {
      reachable: false,
      status: 0,
      isHttps: url.startsWith('https://'),
      error: err.message || 'Direct connection to PDF URL failed',
    };
  }

  return {
    reachable: false,
    status: 0,
    error: 'Verification connection timed out',
  };
}

/**
 * Uploads a PDF document to the configured remote cloud storage provider,
 * and performs strict independent URL verification before resolving.
 */
export async function uploadPdfDocument(
  blob: Blob,
  filename: string,
  config?: StorageConfig,
  onProgress?: (pct: number) => void
): Promise<StorageUploadResult> {
  const activeConfig = config || getSavedStorageConfig();

  if (!isStorageConfigured(activeConfig)) {
    throw new Error(
      `PDF Storage Provider (${activeConfig.provider || 'none'}) is not configured. Please enter your storage credentials in PDF Settings.`
    );
  }

  const provider = createStorageProvider(activeConfig);
  const folder = activeConfig.cloudinary?.folder || 'ebooks';

  // 1. Upload to the cloud provider
  const uploadResult = await provider.uploadFile(blob, folder, filename, onProgress);

  // 2. Perform strict URL check
  if (!isRealPublicPdfUrl(uploadResult.publicUrl)) {
    throw new Error(
      `Invalid public URL returned by storage provider: "${uploadResult.publicUrl}". Must be an accessible public HTTPS address.`
    );
  }

  // 3. Verify public downloadability in an independent request
  const verifyResult = await verifyPublicPdfUrl(uploadResult.publicUrl);
  if (!verifyResult.reachable || !verifyResult.isPdf) {
    throw new Error(
      `Public URL verification failed for "${uploadResult.publicUrl}": ${
        verifyResult.error || 'The uploaded file is not publicly reachable without authentication.'
      }`
    );
  }

  uploadResult.verified = true;
  return uploadResult;
}

/**
 * Upload PDF with automatic exponential backoff retry (up to maxRetries attempts)
 */
export async function uploadPdfWithRetry(
  blob: Blob,
  filename: string,
  config?: StorageConfig,
  maxRetries = 3,
  onProgress?: (pct: number) => void
): Promise<StorageUploadResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[PDF Upload] Uploading "${filename}" to cloud storage (Attempt ${attempt}/${maxRetries})...`);
      const result = await uploadPdfDocument(blob, filename, config, onProgress);
      return result;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[PDF Upload] Attempt ${attempt} failed for "${filename}":`, lastError.message);

      if (attempt < maxRetries) {
        const delayMs = attempt * 1500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error(`Failed to upload PDF "${filename}" after ${maxRetries} attempts.`);
}

/**
 * End-to-end Test: Upload a valid 1-page sample PDF and independently verify the public HTTPS URL.
 */
export async function testStorageProviderConnection(
  config: StorageConfig
): Promise<{ success: boolean; message: string; testUrl?: string }> {
  try {
    if (!isStorageConfigured(config)) {
      return {
        success: false,
        message: 'Storage provider is missing required fields (e.g. Cloud Name, Bucket, or API keys).',
      };
    }

    // Valid minimal PDF 1.4 binary
    const minimalPdfBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xd0, 0xd4, 0xc5, 0xd8, 0x0a,
      0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a, 0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65,
      0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67, 0x2f, 0x50, 0x61, 0x67, 0x65, 0x73, 0x20,
      0x32, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x0a, 0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
      0x32, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a, 0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65,
      0x2f, 0x50, 0x61, 0x67, 0x65, 0x73, 0x2f, 0x4b, 0x69, 0x64, 0x73, 0x5b, 0x33, 0x20, 0x30,
      0x20, 0x52, 0x5d, 0x2f, 0x43, 0x6f, 0x75, 0x6e, 0x74, 0x20, 0x31, 0x3e, 0x3e, 0x0a, 0x65,
      0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a, 0x33, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a, 0x3c,
      0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x50, 0x61, 0x67, 0x65, 0x2f, 0x50, 0x61, 0x72,
      0x65, 0x6e, 0x74, 0x20, 0x32, 0x20, 0x30, 0x20, 0x52, 0x2f, 0x4d, 0x65, 0x64, 0x69, 0x61,
      0x42, 0x6f, 0x78, 0x5b, 0x30, 0x20, 0x30, 0x20, 0x36, 0x31, 0x32, 0x20, 0x37, 0x39, 0x32,
      0x5d, 0x3e, 0x3e, 0x0a, 0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a, 0x78, 0x72, 0x65, 0x66,
      0x0a, 0x30, 0x20, 0x34, 0x0a, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20,
      0x36, 0x35, 0x35, 0x33, 0x35, 0x20, 0x66, 0x20, 0x0a, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30,
      0x30, 0x30, 0x31, 0x35, 0x20, 0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x6e, 0x20, 0x0a, 0x30,
      0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x36, 0x38, 0x20, 0x30, 0x30, 0x30, 0x30, 0x30,
      0x20, 0x6e, 0x20, 0x0a, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x31, 0x33, 0x30, 0x20,
      0x30, 0x30, 0x30, 0x30, 0x30, 0x20, 0x6e, 0x20, 0x0a, 0x74, 0x72, 0x61, 0x69, 0x6c, 0x65,
      0x72, 0x0a, 0x3c, 0x3c, 0x2f, 0x53, 0x69, 0x7a, 0x65, 0x20, 0x34, 0x2f, 0x52, 0x6f, 0x6f,
      0x74, 0x20, 0x31, 0x20, 0x30, 0x20, 0x52, 0x3e, 0x3e, 0x0a, 0x73, 0x74, 0x61, 0x72, 0x74,
      0x78, 0x72, 0x65, 0x66, 0x0a, 0x32, 0x31, 0x37, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a
    ]);

    const testBlob = new Blob([minimalPdfBytes], { type: 'application/pdf' });
    const testFilename = `test_verification_${Date.now()}.pdf`;

    const uploadResult = await uploadPdfDocument(testBlob, testFilename, config);

    return {
      success: true,
      message: `Success! Uploaded test PDF to ${uploadResult.provider} and verified public downloadability without session or cookies.`,
      testUrl: uploadResult.publicUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Storage verification failed: ${err.message || 'Unknown error'}`,
    };
  }
}
