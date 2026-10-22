import { StorageProvider, StorageUploadResult } from './StorageProvider';
import { StorageConfig } from '../../../types/ebook';
import { isRealPublicPdfUrl } from '../pdfStorageService';

export class PostFileStorageProvider implements StorageProvider {
  readonly id = 'postfile';
  readonly name = 'PostFile Cloud CDN (High Speed)';

  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const key = this.config.postfile?.apiKey || '';
    return Boolean(key && key.trim().startsWith('pf_'));
  }

  getPublicUrl(remotePath: string): string {
    if (isRealPublicPdfUrl(remotePath)) {
      return remotePath;
    }
    return '';
  }

  async uploadFile(
    file: Blob | File,
    remoteFolder: string,
    filename: string,
    onProgress?: (pct: number) => void
  ): Promise<StorageUploadResult> {
    const apiKey = (this.config.postfile?.apiKey || '').trim();
    if (!apiKey) {
      throw new Error('PostFile API key is not configured. Please enter your API key in Settings (stored in your browser only).');
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (onProgress) onProgress(15);

    let lastError = '';

    // 1. Try Backend Proxy Upload first (avoids browser CORS issues)
    try {
      if (onProgress) onProgress(30);
      const res = await fetch('/api/storage/pdf/postfile-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: cleanFilename,
          apiKey,
          fileBase64: await blobToBase64(file),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.publicUrl && isRealPublicPdfUrl(data.publicUrl)) {
          if (onProgress) onProgress(100);
          return {
            publicUrl: data.publicUrl,
            filename: cleanFilename,
            fileSize: data.fileSize || file.size,
            provider: 'PostFile Cloud CDN',
            remotePath: data.publicUrl,
            uploadedAt: new Date().toISOString(),
            verified: true,
          };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        lastError = errJson.error || `HTTP ${res.status}`;
      }
    } catch (backendErr: any) {
      console.warn('[PostFile Provider] Backend upload attempt failed, trying direct browser upload:', backendErr.message);
      lastError = backendErr.message;
    }

    // 2. Direct Browser Upload via FormData
    const endpoints = [
      'https://postfile.net/v1/upload',
      'https://upload.postfile.net/v1/upload',
    ];

    for (const endpoint of endpoints) {
      try {
        if (onProgress) onProgress(60);
        const fd = new FormData();
        fd.append('file', file, cleanFilename);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
          },
          body: fd,
        });

        if (res.ok) {
          const data = await res.json();
          const publicUrl = data.url || data.direct_url || data.download_url || (data.data && data.data.url);
          if (publicUrl && isRealPublicPdfUrl(publicUrl)) {
            if (onProgress) onProgress(100);
            return {
              publicUrl,
              filename: cleanFilename,
              fileSize: data.size || file.size,
              provider: 'PostFile Cloud CDN',
              remotePath: publicUrl,
              uploadedAt: new Date().toISOString(),
              verified: true,
            };
          }
        } else {
          const errText = await res.text().catch(() => '');
          lastError = `PostFile returned ${res.status}: ${errText}`;
        }
      } catch (err: any) {
        console.warn(`[PostFile Provider] Upload to ${endpoint} failed:`, err.message);
        lastError = err.message;
      }
    }

    throw new Error(`PostFile upload failed: ${lastError || 'Unable to upload file to PostFile'}`);
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res.includes('base64,') ? res.split('base64,')[1] : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
