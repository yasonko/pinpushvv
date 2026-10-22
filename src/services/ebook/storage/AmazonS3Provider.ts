import { StorageProvider, StorageUploadResult } from './StorageProvider';
import { StorageConfig } from '../../../types/ebook';

export class AmazonS3StorageProvider implements StorageProvider {
  readonly id = 's3';
  readonly name = 'Amazon AWS S3 / S3-Compatible';

  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const bucket = this.config.s3?.bucket?.trim();
    const accessKeyId = this.config.s3?.accessKeyId?.trim();
    const secretAccessKey = this.config.s3?.secretAccessKey?.trim();
    const publicUrlBase = this.config.s3?.publicUrlBase?.trim();
    return Boolean(bucket && accessKeyId && secretAccessKey && publicUrlBase);
  }

  getPublicUrl(remotePath: string): string {
    const publicUrlBase = (this.config.s3?.publicUrlBase || '').replace(/\/+$/, '');
    const cleanPath = remotePath.replace(/^\/+/, '');
    if (!publicUrlBase) return '';
    const baseWithProto = publicUrlBase.startsWith('http') ? publicUrlBase : `https://${publicUrlBase}`;
    return `${baseWithProto}/${cleanPath}`;
  }

  async uploadFile(
    file: Blob | File,
    remoteFolder: string,
    filename: string,
    onProgress?: (pct: number) => void
  ): Promise<StorageUploadResult> {
    const { endpoint, bucket, region, accessKeyId, secretAccessKey, publicUrlBase } = this.config.s3 || {};

    if (!bucket || !accessKeyId || !secretAccessKey || !publicUrlBase) {
      throw new Error('S3 Bucket, Access Keys, and Public Base URL are required in PDF Storage settings.');
    }

    const cleanFolder = (remoteFolder || 'ebooks').replace(/^\/+|\/+$/g, '');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = cleanFolder ? `${cleanFolder}/${cleanFilename}` : cleanFilename;

    if (onProgress) onProgress(10);

    const res = await fetch('/api/storage/pdf/s3-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 's3',
        endpoint,
        bucket,
        region: region || 'us-east-1',
        accessKeyId,
        secretAccessKey,
        publicDomain: publicUrlBase,
        path: fullPath,
        filename: cleanFilename,
        fileBase64: await blobToBase64(file),
      }),
    });

    if (onProgress) onProgress(80);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`S3 Upload failed: ${errorData.error || `HTTP ${res.status}`}`);
    }

    const json = await res.json();
    const publicUrl = json.publicUrl || this.getPublicUrl(fullPath);

    if (onProgress) onProgress(100);

    return {
      publicUrl,
      filename: cleanFilename,
      fileSize: file.size,
      provider: 'Amazon S3',
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
