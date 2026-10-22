import { StorageProvider, StorageUploadResult } from './StorageProvider';
import { StorageConfig } from '../../../types/ebook';

export class SupabaseStorageProvider implements StorageProvider {
  readonly id = 'supabase';
  readonly name = 'Supabase Storage';

  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    const projectUrl = this.config.supabase?.projectUrl?.trim();
    const apiKey = this.config.supabase?.apiKey?.trim();
    const bucket = this.config.supabase?.bucket?.trim();
    return Boolean(projectUrl && apiKey && bucket);
  }

  getPublicUrl(remotePath: string): string {
    const projectUrl = (this.config.supabase?.projectUrl || '').replace(/\/+$/, '');
    const bucket = this.config.supabase?.bucket || 'ebooks';
    const cleanPath = remotePath.replace(/^\/+/, '');
    if (!projectUrl) return '';
    return `${projectUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
  }

  async uploadFile(
    file: Blob | File,
    remoteFolder: string,
    filename: string,
    onProgress?: (pct: number) => void
  ): Promise<StorageUploadResult> {
    const { projectUrl, apiKey, bucket } = this.config.supabase || {};

    if (!projectUrl || !apiKey || !bucket) {
      throw new Error('Supabase project URL, API key, and bucket name are required in PDF Storage settings.');
    }

    const cleanProjectUrl = projectUrl.trim().replace(/\/+$/, '');
    const cleanFolder = (remoteFolder || 'ebooks').replace(/^\/+|\/+$/g, '');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = cleanFolder ? `${cleanFolder}/${cleanFilename}` : cleanFilename;

    const uploadUrl = `${cleanProjectUrl}/storage/v1/object/${bucket}/${fullPath}`;

    if (onProgress) onProgress(10);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        apikey: apiKey.trim(),
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: file,
    });

    if (onProgress) onProgress(80);

    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `HTTP ${res.status}`;
      try {
        const json = JSON.parse(errorText);
        if (json?.message || json?.error) {
          errorMsg = json.message || json.error;
        }
      } catch {
        errorMsg = errorText.slice(0, 150);
      }
      throw new Error(`Supabase Storage upload failed: ${errorMsg}`);
    }

    const publicUrl = this.getPublicUrl(fullPath);

    if (!publicUrl.startsWith('https://')) {
      throw new Error('Supabase generated public URL is not a valid HTTPS address');
    }

    if (onProgress) onProgress(100);

    return {
      publicUrl,
      filename: cleanFilename,
      fileSize: file.size,
      provider: 'Supabase Storage',
      remotePath: fullPath,
      uploadedAt: new Date().toISOString(),
      verified: true,
    };
  }
}
