import { StorageProvider, StorageUploadResult } from './StorageProvider';
import { StorageConfig } from '../../../types/ebook';

export class CloudinaryStorageProvider implements StorageProvider {
  readonly id = 'cloudinary';
  readonly name = 'Cloudinary Media Storage';

  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const cloudName = this.config.cloudinary?.cloudName?.trim();
    const uploadPreset = this.config.cloudinary?.uploadPreset?.trim();
    const apiKey = this.config.cloudinary?.apiKey?.trim();
    return Boolean(cloudName && (uploadPreset || apiKey));
  }

  getPublicUrl(remotePath: string): string {
    const cloudName = this.config.cloudinary?.cloudName?.trim() || '';
    if (!cloudName) return '';
    const cleanPath = remotePath.replace(/^\/+/, '');
    return `https://res.cloudinary.com/${cloudName}/raw/upload/${cleanPath}`;
  }

  async uploadFile(
    file: Blob | File,
    remoteFolder: string,
    filename: string,
    onProgress?: (pct: number) => void
  ): Promise<StorageUploadResult> {
    const { cloudName, uploadPreset, apiKey, apiSecret, folder } = this.config.cloudinary || {};

    if (!cloudName) {
      throw new Error('Cloudinary Cloud Name is required in PDF Storage settings.');
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const cleanFolder = (folder || remoteFolder || 'ebooks').replace(/^\/+|\/+$/g, '');
    const publicId = `${cleanFolder}/${cleanFilename.replace(/\.pdf$/i, '')}`;

    const formData = new FormData();
    formData.append('file', file, cleanFilename);
    formData.append('public_id', publicId);
    formData.append('resource_type', 'raw');

    if (uploadPreset) {
      formData.append('upload_preset', uploadPreset);
    }
    if (apiKey) {
      formData.append('api_key', apiKey);
    }

    const uploadEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

    if (onProgress) onProgress(10);

    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (onProgress) onProgress(80);

    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `HTTP ${res.status}`;
      try {
        const json = JSON.parse(errorText);
        if (json?.error?.message) {
          errorMsg = json.error.message;
        }
      } catch {
        errorMsg = errorText.slice(0, 150);
      }
      throw new Error(`Cloudinary upload failed: ${errorMsg}`);
    }

    const data = await res.json();
    const publicUrl = data.secure_url || data.url;

    if (!publicUrl || !publicUrl.startsWith('https://')) {
      throw new Error('Cloudinary upload succeeded but did not return a secure HTTPS public URL');
    }

    if (onProgress) onProgress(100);

    return {
      publicUrl,
      filename: cleanFilename,
      fileSize: data.bytes || file.size,
      provider: 'Cloudinary',
      remotePath: data.public_id || publicId,
      uploadedAt: data.created_at || new Date().toISOString(),
      verified: true,
    };
  }
}
