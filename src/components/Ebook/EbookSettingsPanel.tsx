import React, { useState, useEffect } from 'react';
import { PdfSettings, PdfPageSize, PdfOrientation, PdfImageFit, PdfQuality, PdfMarginSize, StorageConfig, StorageProviderType, EbookImageItem } from '../../types/ebook';
import { Board, Website } from '../../types';
import { 
  FileText, 
  Settings, 
  Sliders, 
  Layers, 
  Sparkles, 
  Hash, 
  BookOpen, 
  FolderArchive,
  Palette,
  CheckCircle2,
  HelpCircle,
  CloudUpload,
  Server,
  Key,
  Globe,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { getSavedStorageConfig, saveStorageConfig, testStorageProviderConnection, isStorageConfigured } from '../../services/ebook/pdfStorageService';
import { EbookCoverDesigner } from './EbookCoverDesigner';
import { COVER_THEMES_CATALOG } from '../../services/ebook/coverGenerator';

interface EbookSettingsPanelProps {
  settings: PdfSettings;
  onChange: (updated: Partial<PdfSettings>) => void;
  boards: Board[];
  websites: Website[];
  totalImages: number;
  sampleImage?: EbookImageItem;
}

export const EbookSettingsPanel: React.FC<EbookSettingsPanelProps> = ({
  settings,
  onChange,
  boards,
  websites,
  totalImages,
  sampleImage,
}) => {
  const estimatedPdfs = Math.ceil(Math.max(1, totalImages) / Math.max(1, settings.imagesPerPdf));

  // Storage configuration state
  const [storageConfig, setStorageConfig] = useState<StorageConfig>(() => {
    return settings.storageConfig || getSavedStorageConfig();
  });
  const [isTestingStorage, setIsTestingStorage] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; testUrl?: string } | null>(null);

  useEffect(() => {
    if (settings.storageConfig) {
      setStorageConfig(settings.storageConfig);
    }
  }, [settings.storageConfig]);

  const handleProviderChange = (provider: StorageProviderType) => {
    const updated: StorageConfig = {
      ...storageConfig,
      provider,
    };
    setStorageConfig(updated);
    saveStorageConfig(updated);
    onChange({ storageConfig: updated });
    setTestResult(null);
  };

  const handleStorageFieldChange = (partial: Partial<StorageConfig>) => {
    const updated: StorageConfig = {
      ...storageConfig,
      ...partial,
    };
    setStorageConfig(updated);
    saveStorageConfig(updated);
    onChange({ storageConfig: updated });
    setTestResult(null);
  };

  const runConnectionTest = async () => {
    setIsTestingStorage(true);
    setTestResult(null);
    try {
      const res = await testStorageProviderConnection(storageConfig);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setIsTestingStorage(false);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-black/60 dark:backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-sm space-y-6 amoled-card">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 rounded-xl">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">PDF & eBook Configuration</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Configure page geometry, grouping, covers, hosting & naming</p>
          </div>
        </div>

        <div className="bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/40 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          <span>{estimatedPdfs} {estimatedPdfs === 1 ? 'PDF' : 'PDFs'} Estimated</span>
        </div>
      </div>

      {/* PDF HOSTING & PUBLIC CLOUD STORAGE (CRITICAL SECTION) */}
      <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/70 dark:border-blue-900/40 rounded-2xl space-y-4 amoled-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm">
              <CloudUpload className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>PDF STORAGE</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Public Direct Access
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Configure persistent cloud storage (Cloudinary, Supabase, Cloudflare R2, AWS S3) to host real public download URLs without AI Studio cookies or session gates.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer self-start sm:self-center">
            <input
              type="checkbox"
              checked={settings.autoUploadPdf !== false}
              onChange={(e) => onChange({ autoUploadPdf: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Auto-Upload PDFs</span>
          </label>
        </div>

        {/* Configuration Status Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className={`p-2 rounded-xl border flex items-center gap-1.5 ${
            isStorageConfigured(storageConfig)
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
          }`}>
            {isStorageConfigured(storageConfig) ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}
            <span className="font-medium">{isStorageConfigured(storageConfig) ? 'Storage connected' : 'Not configured'}</span>
          </div>

          <div className="p-2 rounded-xl border bg-slate-50 text-slate-700 dark:bg-white/[0.04] dark:text-slate-300 border-slate-200 dark:border-white/[0.08] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Public read access</span>
          </div>

          <div className="p-2 rounded-xl border bg-slate-50 text-slate-700 dark:bg-white/[0.04] dark:text-slate-300 border-slate-200 dark:border-white/[0.08] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Upload available</span>
          </div>

          <div className="p-2 rounded-xl border bg-slate-50 text-slate-700 dark:bg-white/[0.04] dark:text-slate-300 border-slate-200 dark:border-white/[0.08] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>URL verification</span>
          </div>
        </div>

        {/* Warning if storage not configured */}
        {!isStorageConfigured(storageConfig) && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">⚠ PDF hosting is not configured.</span> Enter your Cloudinary, Supabase, or AWS S3 credentials below. Generated PDFs will always be packaged into the local ZIP file, but public HTTPS download links for Pinterest and Excel will only be produced once a storage provider is configured.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Storage Provider Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Provider</span>
            </label>
            <select
              value={storageConfig.provider}
              onChange={(e) => handleProviderChange(e.target.value as StorageProviderType)}
              className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="postfile" className="dark:bg-black">PostFile Cloud CDN (Active Key • Recommended)</option>
              <option value="free_host" className="dark:bg-black">Free Instant PDF Host (Like Images - Zero Setup)</option>
              <option value="cloudinary" className="dark:bg-black">Cloudinary (Instant Public CDN - Free Tier)</option>
              <option value="supabase" className="dark:bg-black">Supabase Storage (Public Bucket)</option>
              <option value="r2" className="dark:bg-black">Cloudflare R2 (0 Egress Fees - S3)</option>
              <option value="s3" className="dark:bg-black">Amazon AWS S3 / Compatible</option>
              <option value="firebase" className="dark:bg-black">Firebase Storage</option>
            </select>
          </div>

          {/* Storage Folder */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Storage Folder
            </label>
            <input
              type="text"
              placeholder="ebooks"
              value={storageConfig.cloudinary?.folder || 'ebooks'}
              onChange={(e) =>
                handleStorageFieldChange({
                  cloudinary: { ...storageConfig.cloudinary, folder: e.target.value } as any,
                })
              }
              className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>

          {/* Test Storage Connection Button */}
          <div className="space-y-1.5 flex flex-col justify-end">
            <button
              type="button"
              onClick={runConnectionTest}
              disabled={isTestingStorage}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm cursor-pointer active:scale-95"
            >
              {isTestingStorage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading & Verifying Test PDF...</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  <span>Test Connection & Public Reachability</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Conditional Provider Credential Inputs */}
        {storageConfig.provider === 'postfile' && (
          <div className="p-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/20 border border-blue-200/80 dark:border-blue-800/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-950 dark:text-blue-200 font-semibold text-xs">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>PostFile Cloud CDN Integration</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  storageConfig.postfile?.apiKey
                    ? 'bg-blue-200/80 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200'
                }`}>
                  {storageConfig.postfile?.apiKey ? 'Saved in Browser' : 'Enter API Key Below'}
                </span>
              </div>
              <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">Stored in Browser LocalStorage Only</span>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
              Your eBook PDFs are uploaded directly to PostFile high-speed cloud CDN with verified permanent public HTTPS download URLs (<code className="bg-blue-100 dark:bg-white/[0.08] px-1 py-0.5 rounded text-[11px]">https://cdn.postfile.download/...</code>). Your API key is stored securely in your local browser only.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>PostFile API Key (X-API-Key)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Browser-only</span>
                </label>
                <input
                  type="text"
                  placeholder="pf_..."
                  value={storageConfig.postfile?.apiKey || ''}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    handleStorageFieldChange({
                      postfile: { apiKey: newKey },
                    });
                    try {
                      localStorage.setItem('pinpulse_postfile_api_key', newKey.trim());
                    } catch {}
                  }}
                  className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex flex-col justify-end space-y-1 text-[11px] text-blue-700 dark:text-blue-300">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" /> Fast direct HTTP 200 public streaming</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" /> Zero session/cookie gatekeeping</span>
              </div>
            </div>
          </div>
        )}
        {storageConfig.provider === 'free_host' && (
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-semibold text-xs">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Zero-Config Free Public PDF Hosting (Like Images)</span>
              <span className="text-[10px] bg-emerald-200/70 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-bold">Active & Ready</span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              Just like Pin images, your generated eBook PDFs are automatically uploaded to high-availability, public HTTPS content networks with permanent direct download links. Zero setup, no API keys or accounts required.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Multi-CDN Redundancy (Catbox, TmpFiles, PixelDrain)</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Automated Public URL Verification</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Pinterest & Excel Direct Downloads Ready</span>
            </div>
          </div>
        )}
        {storageConfig.provider === 'cloudinary' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-white/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cloudinary Cloud Name *
              </label>
              <input
                type="text"
                placeholder="e.g. my-cloud-name"
                value={storageConfig.cloudinary?.cloudName || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    cloudinary: { ...storageConfig.cloudinary, cloudName: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Upload Preset (Unsigned) *
              </label>
              <input
                type="text"
                placeholder="e.g. ebooks_preset or ml_default"
                value={storageConfig.cloudinary?.uploadPreset || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    cloudinary: { ...storageConfig.cloudinary, uploadPreset: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                In Cloudinary Console &gt; Settings &gt; Upload &gt; Add unsigned upload preset
              </p>
            </div>
          </div>
        )}

        {storageConfig.provider === 'supabase' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 bg-white/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Supabase Project URL *
              </label>
              <input
                type="text"
                placeholder="https://xyz.supabase.co"
                value={storageConfig.supabase?.projectUrl || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    supabase: { ...storageConfig.supabase, projectUrl: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Public Bucket Name *
              </label>
              <input
                type="text"
                placeholder="e.g. ebooks"
                value={storageConfig.supabase?.bucket || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    supabase: { ...storageConfig.supabase, bucket: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                API Key (Anon / Service) *
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                value={storageConfig.supabase?.apiKey || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    supabase: { ...storageConfig.supabase, apiKey: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {storageConfig.provider === 'r2' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-3.5 bg-white/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bucket Name *</label>
              <input
                type="text"
                placeholder="e.g. my-ebooks"
                value={storageConfig.r2?.bucket || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    r2: { ...storageConfig.r2, bucket: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Public R2 Domain / Custom URL *</label>
              <input
                type="text"
                placeholder="https://pub-xxxx.r2.dev or cdn.example.com"
                value={storageConfig.r2?.publicDomain || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    r2: { ...storageConfig.r2, publicDomain: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Account ID *</label>
              <input
                type="text"
                placeholder="Cloudflare Account ID"
                value={storageConfig.r2?.accountId || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    r2: { ...storageConfig.r2, accountId: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Access Key ID *</label>
              <input
                type="text"
                placeholder="R2 Access Key"
                value={storageConfig.r2?.accessKeyId || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    r2: { ...storageConfig.r2, accessKeyId: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Secret Access Key *</label>
              <input
                type="password"
                placeholder="R2 Secret Key"
                value={storageConfig.r2?.secretAccessKey || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    r2: { ...storageConfig.r2, secretAccessKey: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {storageConfig.provider === 's3' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-3.5 bg-white/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">S3 Bucket Name *</label>
              <input
                type="text"
                placeholder="e.g. my-public-bucket"
                value={storageConfig.s3?.bucket || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    s3: { ...storageConfig.s3, bucket: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Public Base URL / CloudFront *</label>
              <input
                type="text"
                placeholder="https://my-bucket.s3.amazonaws.com"
                value={storageConfig.s3?.publicUrlBase || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    s3: { ...storageConfig.s3, publicUrlBase: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Region</label>
              <input
                type="text"
                placeholder="us-east-1"
                value={storageConfig.s3?.region || 'us-east-1'}
                onChange={(e) =>
                  handleStorageFieldChange({
                    s3: { ...storageConfig.s3, region: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Access Key ID *</label>
              <input
                type="text"
                placeholder="AKIA..."
                value={storageConfig.s3?.accessKeyId || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    s3: { ...storageConfig.s3, accessKeyId: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Secret Access Key *</label>
              <input
                type="password"
                placeholder="Secret Key"
                value={storageConfig.s3?.secretAccessKey || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    s3: { ...storageConfig.s3, secretAccessKey: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {storageConfig.provider === 'firebase' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-white/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Storage Bucket Name *
              </label>
              <input
                type="text"
                placeholder="e.g. project-id.appspot.com"
                value={storageConfig.firebase?.storageBucket || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    firebase: { ...storageConfig.firebase, storageBucket: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Firebase Web API Key (Optional)
              </label>
              <input
                type="password"
                placeholder="Enter Web API Key..."
                value={storageConfig.firebase?.apiKey || ''}
                onChange={(e) =>
                  handleStorageFieldChange({
                    firebase: { ...storageConfig.firebase, apiKey: e.target.value } as any,
                  })
                }
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <div className="flex-1">
              <div>{testResult.message}</div>
              {testResult.testUrl && (
                <a
                  href={testResult.testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] underline font-medium text-emerald-700 dark:text-emerald-300 mt-0.5 inline-block"
                >
                  Verified Test URL: {testResult.testUrl}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Images Per PDF */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Images Per PDF</span>
            <span className="text-[11px] font-normal text-slate-400">Default: 20</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="500"
              value={settings.imagesPerPdf}
              onChange={(e) => onChange({ imagesPerPdf: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400">pages / pdf</span>
          </div>
        </div>

        {/* Naming Prefix */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            PDF Naming Prefix
          </label>
          <input
            type="text"
            placeholder="e.g. Cute_Animals"
            value={settings.namingPrefix}
            onChange={(e) => onChange({ namingPrefix: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_') })}
            className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Start Number */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Start Number
          </label>
          <input
            type="number"
            min="1"
            value={settings.startNumber}
            onChange={(e) => onChange({ startNumber: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Page Size */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            PDF Page Size
          </label>
          <select
            value={settings.pageSize}
            onChange={(e) => onChange({ pageSize: e.target.value as PdfPageSize })}
            className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="A4" className="dark:bg-black">A4 (210 × 297 mm)</option>
            <option value="LETTER" className="dark:bg-black">US Letter (8.5 × 11 in)</option>
            <option value="SQUARE" className="dark:bg-black">Square (210 × 210 mm)</option>
            <option value="CUSTOM" className="dark:bg-black">Custom Dimensions</option>
          </select>
        </div>

        {/* Orientation */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Orientation
          </label>
          <select
            value={settings.orientation}
            onChange={(e) => onChange({ orientation: e.target.value as PdfOrientation })}
            className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="portrait" className="dark:bg-black">Portrait (Vertical)</option>
            <option value="landscape" className="dark:bg-black">Landscape (Horizontal)</option>
          </select>
        </div>

        {/* Image Fit Mode */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Image Fit Mode
          </label>
          <select
            value={settings.imageFit}
            onChange={(e) => onChange({ imageFit: e.target.value as PdfImageFit })}
            className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="contain" className="dark:bg-black">Contain (No crop, preserve aspect ratio)</option>
            <option value="cover" className="dark:bg-black">Cover (Fill page full-bleed)</option>
          </select>
        </div>

        {/* Page Margins */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Page Margins
          </label>
          <select
            value={settings.margins}
            onChange={(e) => onChange({ margins: e.target.value as PdfMarginSize })}
            className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="none" className="dark:bg-black">None (0 mm)</option>
            <option value="small" className="dark:bg-black">Small Margins (6 mm)</option>
            <option value="medium" className="dark:bg-black">Medium Margins (14 mm)</option>
          </select>
        </div>

        {/* Quality */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Render Quality
          </label>
          <select
            value={settings.quality}
            onChange={(e) => onChange({ quality: e.target.value as PdfQuality })}
            className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="standard" className="dark:bg-black">Standard (Fast, optimized size)</option>
            <option value="high" className="dark:bg-black">High Resolution (Print Ready)</option>
          </select>
        </div>

        {/* Cover Theme Quick Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Cover Theme</span>
            </span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
              {settings.generateCover && settings.coverTheme !== 'none' ? 'Active' : 'Disabled'}
            </span>
          </label>
          <select
            value={settings.generateCover ? (settings.coverTheme || 'modern') : 'none'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'none') {
                onChange({ generateCover: false, coverTheme: 'none', addCoverAsFirstPage: false });
              } else {
                onChange({ generateCover: true, coverTheme: val as any, addCoverAsFirstPage: true });
              }
            }}
            className="w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="none" className="dark:bg-black">None (No Cover — Direct to Content)</option>
            <option value="modern" className="dark:bg-black">Modern Tech & Studio (Obsidian & Cyan)</option>
            <option value="minimal" className="dark:bg-black">Scandinavian Minimalist (Alabaster & Charcoal)</option>
            <option value="elegant" className="dark:bg-black">Luxury Royale & Gold (Onyx & Champagne)</option>
            <option value="magazine" className="dark:bg-black">Lifestyle Editorial (Masthead & Barcode)</option>
            <option value="nature" className="dark:bg-black">Botanical Earth & Sage (Rainforest Emerald)</option>
            <option value="vintage" className="dark:bg-black">Classic Heritage Parchment (Aged Leather)</option>
            <option value="playful" className="dark:bg-black">Vibrant Creative & Amber (Warm Sunrise)</option>
            <option value="gradient" className="dark:bg-black">Twilight Aurora & Violet (Nebula Glow)</option>
            <option value="dark" className="dark:bg-black">Cyber Noir & Crimson (Laser Editorial)</option>
          </select>
        </div>
      </div>

      {/* Interactive Cover Designer & Real-time Live Preview */}
      <EbookCoverDesigner
        settings={settings}
        onChange={onChange}
        sampleImage={sampleImage}
      />

      {/* Toggles & Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-white/[0.08]">
        {/* Page Numbers */}
        <label className="flex items-start gap-3 p-3 bg-slate-50/60 dark:bg-white/[0.03] rounded-xl border border-slate-200/60 dark:border-white/[0.06] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.06] transition-colors">
          <input
            type="checkbox"
            checked={settings.pageNumbers}
            onChange={(e) => onChange({ pageNumbers: e.target.checked })}
            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Page Numbers</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Footer numbering (e.g. 1/20)</div>
          </div>
        </label>

        {/* Generate Cover */}
        <label className="flex items-start gap-3 p-3 bg-slate-50/60 dark:bg-white/[0.03] rounded-xl border border-slate-200/60 dark:border-white/[0.06] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.06] transition-colors">
          <input
            type="checkbox"
            checked={settings.generateCover && settings.coverTheme !== 'none'}
            onChange={(e) => {
              const isChecked = e.target.checked;
              onChange({ 
                generateCover: isChecked, 
                coverTheme: isChecked ? (settings.coverTheme === 'none' ? 'modern' : settings.coverTheme || 'modern') : 'none',
                addCoverAsFirstPage: isChecked ? settings.addCoverAsFirstPage : false
              });
            }}
            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Generate Cover</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {settings.generateCover && settings.coverTheme !== 'none' ? 'Render front cover' : 'Disabled (No cover)'}
            </div>
          </div>
        </label>

        {/* Insert Cover as Page 1 */}
        <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
          settings.generateCover && settings.coverTheme !== 'none'
            ? 'bg-slate-50/60 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/[0.06] hover:bg-slate-100/60 dark:hover:bg-white/[0.06]' 
            : 'opacity-40 pointer-events-none border-slate-200 dark:border-white/[0.04]'
        }`}>
          <input
            type="checkbox"
            disabled={!settings.generateCover || settings.coverTheme === 'none'}
            checked={settings.addCoverAsFirstPage && settings.generateCover && settings.coverTheme !== 'none'}
            onChange={(e) => onChange({ addCoverAsFirstPage: e.target.checked })}
            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Cover as Page 1</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Add cover inside PDF binary</div>
          </div>
        </label>

        {/* PDF Folder in ZIP */}
        <label className="flex items-start gap-3 p-3 bg-slate-50/60 dark:bg-white/[0.03] rounded-xl border border-slate-200/60 dark:border-white/[0.06] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.06] transition-colors">
          <input
            type="checkbox"
            checked={settings.pdfFolderInZip}
            onChange={(e) => onChange({ pdfFolderInZip: e.target.checked })}
            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">PDFs in Subfolder</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Place inside /PDFs in ZIP</div>
          </div>
        </label>
      </div>

      {/* Pinterest Integration Settings */}
      <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl space-y-3 amoled-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">Pinterest Integration & Bulk Preparation</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={settings.pinterestIntegration}
              onChange={(e) => onChange({ pinterestIntegration: e.target.checked })}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>Prepare for Pinterest</span>
          </label>
        </div>

        {settings.pinterestIntegration && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">Target Pinterest Board</label>
              <select
                value={settings.defaultBoardId || ''}
                onChange={(e) => onChange({ defaultBoardId: e.target.value })}
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
              >
                <option value="" className="dark:bg-black">Select Board</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id} className="dark:bg-black">{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block mb-1">Destination Website Link</label>
              <select
                value={settings.defaultWebsiteId || ''}
                onChange={(e) => onChange({ defaultWebsiteId: e.target.value })}
                className="w-full bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
              >
                <option value="" className="dark:bg-black">Select Website</option>
                {websites.map((w) => (
                  <option key={w.id} value={w.id} className="dark:bg-black">{w.name} ({w.url})</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

