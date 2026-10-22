import { StorageProvider } from './StorageProvider';
import { PostFileStorageProvider } from './PostFileProvider';
import { FreePdfStorageProvider } from './FreePdfStorageProvider';
import { CloudinaryStorageProvider } from './CloudinaryProvider';
import { SupabaseStorageProvider } from './SupabaseProvider';
import { CloudflareR2StorageProvider } from './CloudflareR2Provider';
import { AmazonS3StorageProvider } from './AmazonS3Provider';
import { FirebaseStorageProvider } from './FirebaseStorageProvider';
import { StorageConfig, StorageProviderType } from '../../../types/ebook';

export interface ProviderMeta {
  id: StorageProviderType;
  name: string;
  badge: string;
  description: string;
  isFreeTierAvailable: boolean;
  setupGuideUrl?: string;
  quickTips: string;
}

export const SUPPORTED_STORAGE_PROVIDERS: ProviderMeta[] = [
  {
    id: 'postfile',
    name: 'PostFile Cloud CDN (Recommended)',
    badge: 'Browser Saved • Ultra Fast',
    description: 'Direct high-speed CDN hosting with permanent public HTTPS download URLs powered by PostFile API.',
    isFreeTierAvailable: true,
    quickTips: 'Enter your PostFile API key (pf_...) in settings — saved securely in your browser localStorage only. Automatically verifies reachable PDF download links.',
  },
  {
    id: 'free_host',
    name: 'Free Instant PDF Host (Like Images)',
    badge: '100% Free • Multi-CDN',
    description: 'Instant zero-configuration public PDF CDN. Uploads immediately and provides verified direct HTTPS download links with no accounts or API keys required.',
    isFreeTierAvailable: true,
    quickTips: 'Works right out of the box with zero setup! Uses high-availability public PDF storage networks (Catbox, TmpFiles, PixelDrain) for permanent/direct access.',
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary Media Storage',
    badge: 'Popular & Custom Cloud',
    description: 'Direct unsigned/preset cloud upload with instant global CDN HTTPS delivery.',
    isFreeTierAvailable: true,
    quickTips: 'Create a free Cloudinary account, add an Unsigned Upload Preset in Settings > Upload, and enter your Cloud Name.',
  },
  {
    id: 'supabase',
    name: 'Supabase Storage',
    badge: 'Fast & Generous Free Tier',
    description: 'PostgreSQL-backed object storage with public bucket HTTPS URLs.',
    isFreeTierAvailable: true,
    quickTips: 'Create a public bucket in Supabase Storage (e.g. "ebooks"), then paste your Project URL and anon API key.',
  },
  {
    id: 'r2',
    name: 'Cloudflare R2',
    badge: 'Zero Egress Fees',
    description: 'High-speed S3-compatible cloud storage with public r2.dev domain or custom domain.',
    isFreeTierAvailable: true,
    quickTips: 'Enable Public Bucket access in R2 settings, copy your Account ID, and create an API Token.',
  },
  {
    id: 's3',
    name: 'Amazon AWS S3 / S3-Compatible',
    badge: 'Industry Standard',
    description: 'Standard AWS S3 or compatible object storage (Wasabi, Backblaze B2, MinIO).',
    isFreeTierAvailable: false,
    quickTips: 'Ensure your bucket has public read policy enabled or configure CloudFront distribution.',
  },
  {
    id: 'firebase',
    name: 'Firebase Storage',
    badge: 'Google Cloud Platform',
    description: 'Direct integration with Google Firebase Storage buckets.',
    isFreeTierAvailable: true,
    quickTips: 'Set your Firebase Storage bucket (e.g. your-project.appspot.com) with public read access.',
  },
];

/**
 * Creates and returns the appropriate StorageProvider instance based on config
 */
export function createStorageProvider(config: StorageConfig): StorageProvider {
  const providerType = config.provider || 'postfile';

  switch (providerType) {
    case 'postfile':
      return new PostFileStorageProvider(config);
    case 'free_host':
      return new FreePdfStorageProvider(config);
    case 'cloudinary':
      return new CloudinaryStorageProvider(config);
    case 'supabase':
      return new SupabaseStorageProvider(config);
    case 'r2':
      return new CloudflareR2StorageProvider(config);
    case 's3':
      return new AmazonS3StorageProvider(config);
    case 'firebase':
      return new FirebaseStorageProvider(config);
    default:
      return new PostFileStorageProvider(config);
  }
}

/**
 * Checks if the configured storage provider has all required fields to function
 */
export function isStorageConfigured(config?: StorageConfig): boolean {
  if (!config) return false;
  const provider = createStorageProvider(config);
  return provider.isConfigured();
}
