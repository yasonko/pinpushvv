import { StorageProvider, StorageUploadResult } from './StorageProvider';
import { StorageConfig } from '../../../types/ebook';

export class FirebaseStorageProvider implements StorageProvider {
  readonly id = 'firebase';
  readonly name = 'Firebase Storage';

  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const storageBucket = this.config.firebase?.storageBucket?.trim();
    return Boolean(storageBucket);
  }

  getPublicUrl(remotePath: string): string {
    const storageBucket = (this.config.firebase?.storageBucket || '').replace(/\/+$/, '');
    const cleanPath = remotePath.replace(/^\/+/, '');
    if (!storageBucket) return '';
    const encodedPath = encodeURIComponent(cleanPath);
    return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodedPath}?alt=media`;
  }

  async uploadFile(
    file: Blob | File,
    remoteFolder: string,
    filename: string,
    onProgress?: (pct: number) => void
  ): Promise<StorageUploadResult> {
    const { storageBucket, apiKey } = this.config.firebase || {};

    if (!storageBucket) {
      throw new Error('Firebase Storage Bucket is required in PDF Storage settings.');
    }

    const cleanFolder = (remoteFolder || 'ebooks').replace(/^\/+|\/+$/g, '');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = cleanFolder ? `${cleanFolder}/${cleanFilename}` : cleanFilename;
    const encodedPath = encodeURIComponent(fullPath);

    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?uploadType=media&name=${encodedPath}${
      apiKey ? `&key=${apiKey}` : ''
    }`;

    if (onProgress) onProgress(10);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: file,
    });

    if (onProgress) onProgress(80);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Firebase Storage upload failed (HTTP ${res.status}): ${errorText.slice(0, 150)}`);
    }

    const publicUrl = this.getPublicUrl(fullPath);

    if (onProgress) onProgress(100);

    return {
      publicUrl,
      filename: cleanFilename,
      fileSize: file.size,
      provider: 'Firebase Storage',
      remotePath: fullPath,
      uploadedAt: new Date().toISOString(),
      verified: true,
    };
  }
}
