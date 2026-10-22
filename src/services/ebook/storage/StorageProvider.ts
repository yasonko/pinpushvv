import { StorageConfig, StorageProviderType } from '../../../types/ebook';

export interface StorageUploadResult {
  publicUrl: string;
  filename: string;
  fileSize: number;
  provider: string;
  remotePath: string;
  uploadedAt: string;
  verified: boolean;
}

export interface UrlVerificationResult {
  reachable: boolean;
  status: number;
  contentType?: string;
  contentLength?: number;
  isPdf?: boolean;
  isHttps?: boolean;
  isHtml?: boolean;
  error?: string;
}

/**
 * Common interface for all PDF Cloud Storage Providers
 */
export interface StorageProvider {
  readonly id: StorageProviderType;
  readonly name: string;

  /**
   * Check if provider has required credentials / configuration
   */
  isConfigured(): boolean;

  /**
   * Uploads a PDF file/blob to the remote storage
   */
  uploadFile(
    file: Blob | File, 
    remotePath: string, 
    filename: string,
    onProgress?: (pct: number) => void
  ): Promise<StorageUploadResult>;

  /**
   * Derives or formats the public HTTPS download URL
   */
  getPublicUrl(remotePath: string): string;

  /**
   * Checks if a file exists at remote path (optional)
   */
  fileExists?(remotePath: string): Promise<boolean>;

  /**
   * Deletes a file at remote path (optional)
   */
  deleteFile?(remotePath: string): Promise<boolean>;
}
