import { StorageProvider, StorageUploadResult } from './StorageProvider';
import { StorageConfig } from '../../../types/ebook';
import { isRealPublicPdfUrl } from '../pdfStorageService';

export class FreePdfStorageProvider implements StorageProvider {
  readonly id = 'free_host';
  readonly name = 'Free Public PDF Host (Instant - Zero Setup)';

  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    // Free hosting is always ready and requires zero credentials!
    return true;
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
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (onProgress) onProgress(10);

    let lastError = '';

    // 1. First attempt: Upload via backend free-host router (handles Catbox / TmpFiles / PixelDrain server-side)
    try {
      if (onProgress) onProgress(25);
      const res = await fetch('/api/storage/pdf/free-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: cleanFilename,
          folder: remoteFolder || 'ebooks',
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
            provider: data.provider || 'Free PDF Host',
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
      console.warn('[Free PDF Host] Backend upload failed, attempting direct browser upload:', backendErr.message);
      lastError = backendErr.message;
    }

    // 2. Direct Browser Fallback: Catbox.moe
    try {
      if (onProgress) onProgress(50);
      console.log('[Free PDF Host] Attempting direct browser upload to Catbox...');
      const catboxForm = new FormData();
      catboxForm.append('reqtype', 'fileupload');
      catboxForm.append('fileToUpload', file, cleanFilename);

      const catboxRes = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: catboxForm,
      });

      if (catboxRes.ok) {
        const directUrl = (await catboxRes.text()).trim();
        if (isRealPublicPdfUrl(directUrl)) {
          if (onProgress) onProgress(100);
          return {
            publicUrl: directUrl,
            filename: cleanFilename,
            fileSize: file.size,
            provider: 'Catbox Cloud (Free)',
            remotePath: directUrl,
            uploadedAt: new Date().toISOString(),
            verified: true,
          };
        }
      }
    } catch (catboxErr: any) {
      console.warn('[Free PDF Host] Catbox direct upload failed:', catboxErr.message);
      lastError = catboxErr.message;
    }

    // 3. Direct Browser Fallback: TmpFiles.org
    try {
      if (onProgress) onProgress(75);
      console.log('[Free PDF Host] Attempting direct browser upload to TmpFiles...');
      const tmpForm = new FormData();
      tmpForm.append('file', file, cleanFilename);

      const tmpRes = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: tmpForm,
      });

      if (tmpRes.ok) {
        const json = await tmpRes.json();
        const rawUrl = json?.data?.url;
        if (rawUrl) {
          // Convert https://tmpfiles.org/12345/file.pdf to direct download https://tmpfiles.org/dl/12345/file.pdf
          const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          if (isRealPublicPdfUrl(directUrl)) {
            if (onProgress) onProgress(100);
            return {
              publicUrl: directUrl,
              filename: cleanFilename,
              fileSize: file.size,
              provider: 'TmpFiles CDN (Free)',
              remotePath: directUrl,
              uploadedAt: new Date().toISOString(),
              verified: true,
            };
          }
        }
      }
    } catch (tmpErr: any) {
      console.warn('[Free PDF Host] TmpFiles direct upload failed:', tmpErr.message);
      lastError = tmpErr.message;
    }

    // 4. Direct Browser Fallback: PixelDrain
    try {
      if (onProgress) onProgress(85);
      console.log('[Free PDF Host] Attempting direct browser upload to PixelDrain...');
      const pxRes = await fetch(`https://pixeldrain.com/api/file/${encodeURIComponent(cleanFilename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });

      if (pxRes.ok) {
        const json = await pxRes.json();
        if (json?.id) {
          const directUrl = `https://pixeldrain.com/api/file/${json.id}`;
          if (isRealPublicPdfUrl(directUrl)) {
            if (onProgress) onProgress(100);
            return {
              publicUrl: directUrl,
              filename: cleanFilename,
              fileSize: file.size,
              provider: 'PixelDrain (Free)',
              remotePath: directUrl,
              uploadedAt: new Date().toISOString(),
              verified: true,
            };
          }
        }
      }
    } catch (pxErr: any) {
      console.warn('[Free PDF Host] PixelDrain direct upload failed:', pxErr.message);
      lastError = pxErr.message;
    }

    throw new Error(`Free PDF upload failed across all public providers: ${lastError || 'Service temporarily unreachable'}`);
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
