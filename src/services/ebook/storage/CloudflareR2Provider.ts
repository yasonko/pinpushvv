import { StorageProvider, StorageUploadResult } from './StorageProvider';
import { StorageConfig } from '../../../types/ebook';

export class CloudflareR2StorageProvider implements StorageProvider {
  readonly id = 'r2';
  readonly name = 'Cloudflare R2 (S3-Compatible)';

  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const bucket = this.config.r2?.bucket?.trim();
    const publicDomain = this.config.r2?.publicDomain?.trim();
    const accountId = this.config.r2?.accountId?.trim();
    const accessKeyId = this.config.r2?.accessKeyId?.trim();
    const secretAccessKey = this.config.r2?.secretAccessKey?.trim();
    return Boolean(bucket && publicDomain && accountId && accessKeyId && secretAccessKey);
  }

  getPublicUrl(remotePath: string): string {
    const publicDomain = (this.config.r2?.publicDomain || '').replace(/\/+$/, '');
    const cleanPath = remotePath.replace(/^\/+/, '');
    if (!publicDomain) return '';
    const domainWithProto = publicDomain.startsWith('http') ? publicDomain : `https://${publicDomain}`;
    return `${domainWithProto}/${cleanPath}`;
  }

  async uploadFile(
    file: Blob | File,
    remoteFolder: string,
    filename: string,
    onProgress?: (pct: number) => void
  ): Promise<StorageUploadResult> {
    const { accountId, bucket, accessKeyId, secretAccessKey, publicDomain } = this.config.r2 || {};

    if (!bucket || !publicDomain || !accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Cloudflare R2 Account ID, Bucket, Access Keys, and Public Domain are required.');
    }

    const cleanFolder = (remoteFolder || 'ebooks').replace(/^\/+|\/+$/g, '');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = cleanFolder ? `${cleanFolder}/${cleanFilename}` : cleanFilename;

    if (onProgress) onProgress(10);

    // Upload via backend proxy to sign S3 request securely without exposing secrets or dealing with browser CORS issues
    const res = await fetch('/api/storage/pdf/s3-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'r2',
        accountId,
        bucket,
        accessKeyId,
        secretAccessKey,
        publicDomain,
        path: fullPath,
        filename: cleanFilename,
        fileBase64: await blobToBase64(file),
      }),
    });

    if (onProgress) onProgress(80);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`R2 Upload failed: ${errorData.error || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    const publicUrl = json.publicUrl || this.getPublicUrl(fullPath);

    if (onProgress) onProgress(100);

    return {
      publicUrl,
      filename: cleanFilename,
      fileSize: file.size,
      provider: 'Cloudflare R2',
      remotePath: fullPath,
      uploadedAt: new Date().toISOString(),
      verified: true,
    };
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
