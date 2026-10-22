import React, { useState } from 'react';
import { 
  Settings, 
  Sparkles, 
  Key, 
  Clock, 
  Languages, 
  ShieldCheck, 
  FolderHeart, 
  Globe, 
  Trash2, 
  Check, 
  Cpu, 
  AlertCircle, 
  ExternalLink, 
  RotateCw,
  Sliders,
  Hourglass,
  Moon,
  Sun,
  Palette,
  Puzzle,
  Radio,
  RefreshCw,
  Download,
  Save,
  Cloud,
  FileText
} from 'lucide-react';
import { AppSettings, PinterestAccount, Board, Website } from '../../types';
import { pinterestApi } from '../../services/pinterestApi';
import { 
  getExtensionId, 
  setExtensionId, 
  checkExtensionConnection,
  downloadExtensionZip 
} from '../../services/extensionBridge';
import { ExtensionConnectionResult } from '../../types/extensionProtocol';
import { getSavedStorageConfig, saveStorageConfig, verifyPublicPdfUrl, getSavedPostFileKey, savePostFileKey } from '../../services/ebook/pdfStorageService';

interface SettingsViewProps {
  settings: AppSettings;
  pinterestAccount: PinterestAccount | null;
  boards: Board[];
  websites: Website[];
  onSaveSettings: (settings: AppSettings) => void;
  onSavePinterestAccount: (account: PinterestAccount | null) => void;
  onResetAllData: () => void;
  onClearAllPins: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  pinterestAccount,
  boards,
  websites,
  onSaveSettings,
  onSavePinterestAccount,
  onResetAllData,
  onClearAllPins,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [formData, setFormData] = useState<AppSettings>({
    ...settings,
    aiMinDelaySeconds: settings.aiMinDelaySeconds ?? 15,
    aiMaxDelaySeconds: settings.aiMaxDelaySeconds ?? 30,
  });
  const [accessTokenInput, setAccessTokenInput] = useState(pinterestAccount?.accessToken || '');
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [tokenTestStatus, setTokenTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [tokenErrorMessage, setTokenErrorMessage] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Companion Extension Settings
  const [extensionIdInput, setExtensionIdInput] = useState(getExtensionId() || '');
  const [extConnectionResult, setExtConnectionResult] = useState<ExtensionConnectionResult | null>(null);
  const [isCheckingExt, setIsCheckingExt] = useState(false);
  const [extSaveSuccess, setExtSaveSuccess] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // PostFile Cloud Storage API Configuration (Stored in browser localStorage only)
  const [postFileKeyInput, setPostFileKeyInput] = useState(() => {
    return getSavedPostFileKey();
  });
  const [postFileSaveSuccess, setPostFileSaveSuccess] = useState(false);
  const [isTestingPostFile, setIsTestingPostFile] = useState(false);
  const [postFileTestResult, setPostFileTestResult] = useState<{
    success: boolean;
    url?: string;
    message?: string;
    testedAt?: string;
  } | null>(null);

  // Custom AI Endpoint State & Testing
  const [isTestingCustomAi, setIsTestingCustomAi] = useState(false);
  const [customAiTestResult, setCustomAiTestResult] = useState<{
    success: boolean;
    message: string;
    model?: string;
  } | null>(null);

  const handleTestCustomAi = async () => {
    const url = (formData.customApiUrl || '').trim();
    if (!url) {
      setCustomAiTestResult({
        success: false,
        message: 'Please enter a valid Custom AI API Endpoint URL first (e.g. https://api.openai.com/v1/chat/completions or your proxy URL).',
      });
      return;
    }

    setIsTestingCustomAi(true);
    setCustomAiTestResult(null);

    try {
      const res = await fetch('/api/ai/analyze-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'custom',
          customApiUrl: url,
          customApiKey: (formData.customApiKey || '').trim(),
          customApiModel: (formData.customApiModel || '').trim() || 'gpt-4o',
          imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          filename: 'custom-api-test.png',
          timeout: 15000,
          maxRetries: 1,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to reach custom endpoint`);
      }

      const data = await res.json();
      setCustomAiTestResult({
        success: true,
        message: `Connected successfully! Model "${data.model || formData.customApiModel || 'custom'}" returned valid Pinterest metadata.`,
        model: data.model,
      });
    } catch (err: any) {
      setCustomAiTestResult({
        success: false,
        message: err.message || 'Connection test failed. Please verify the URL and credentials.',
      });
    } finally {
      setIsTestingCustomAi(false);
    }
  };

  // Groq Testing State & Runner
  const [isTestingGroq, setIsTestingGroq] = useState(false);
  const [groqTestResult, setGroqTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestGroq = async () => {
    setIsTestingGroq(true);
    setGroqTestResult(null);
    try {
      const res = await fetch('/api/ai/analyze-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'groq',
          groqApiKey: (formData.groqApiKey || '').trim(),
          groqModel: (formData.groqModel || '').trim() || 'openai/gpt-oss-120b',
          imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          filename: 'groq-connection-test.png',
          timeout: 15000,
          maxRetries: 1,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to reach Groq API`);
      }

      const data = await res.json();
      setGroqTestResult({
        success: true,
        message: `Groq connected and verified! Model: "${data.model || formData.groqModel || 'openai/gpt-oss-120b'}" generated title: "${data.title}"`,
      });
    } catch (err: any) {
      setGroqTestResult({
        success: false,
        message: err.message || 'Groq connection failed',
      });
    } finally {
      setIsTestingGroq(false);
    }
  };

  // OpenRouter Testing State & Runner
  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);
  const [openRouterTestResult, setOpenRouterTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestOpenRouter = async () => {
    setIsTestingOpenRouter(true);
    setOpenRouterTestResult(null);
    try {
      const res = await fetch('/api/ai/analyze-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openrouter',
          openrouterApiKey: (formData.openrouterApiKey || '').trim(),
          openrouterModel: (formData.openrouterModel || '').trim() || 'openrouter/auto',
          imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          filename: 'openrouter-connection-test.png',
          timeout: 20000,
          maxRetries: 1,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to reach OpenRouter`);
      }

      const data = await res.json();
      setOpenRouterTestResult({
        success: true,
        message: `OpenRouter connected and verified! Model: "${data.model || formData.openrouterModel || 'auto'}" generated title: "${data.title}"`,
      });
    } catch (err: any) {
      setOpenRouterTestResult({
        success: false,
        message: err.message || 'OpenRouter connection failed',
      });
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  const handleSavePostFileKey = () => {
    const cleanKey = (postFileKeyInput || '').trim();
    savePostFileKey(cleanKey);
    setPostFileKeyInput(cleanKey);
    setPostFileSaveSuccess(true);
    setTimeout(() => setPostFileSaveSuccess(false), 2500);
  };

  const handleTestPostFileUpload = async () => {
    setIsTestingPostFile(true);
    setPostFileTestResult(null);

    try {
      const cleanKey = (postFileKeyInput || '').trim() || getSavedPostFileKey();
      if (!cleanKey) {
        throw new Error('Please enter your PostFile API key first before testing');
      }
      const sampleContent = `%PDF-1.4\n1 0 obj\n<< /Title (PostFile Storage Integration Test) /Author (PinPulse) >>\nendobj\n2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000079 00000 n\n0000000130 00000 n\n0000000185 00000 n\ntrailer\n<< /Size 5 /Root 2 0 R >>\nstartxref\n268\n%%EOF`;
      const base64Pdf = btoa(sampleContent);
      const testFilename = `PostFile_Verification_${Date.now()}.pdf`;

      const res = await fetch('/api/storage/pdf/postfile-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: testFilename,
          apiKey: cleanKey,
          fileBase64: base64Pdf,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.publicUrl) {
        throw new Error('PostFile did not return a public download URL');
      }

      const verify = await verifyPublicPdfUrl(data.publicUrl);
      if (verify.reachable) {
        setPostFileTestResult({
          success: true,
          url: data.publicUrl,
          message: `PostFile API key verified! Upload and public CDN URL streaming active.`,
          testedAt: new Date().toLocaleTimeString(),
        });
      } else {
        setPostFileTestResult({
          success: false,
          url: data.publicUrl,
          message: `Uploaded to PostFile, but public CDN verification returned: ${verify.error || 'Unreachable'}`,
          testedAt: new Date().toLocaleTimeString(),
        });
      }
    } catch (err: any) {
      setPostFileTestResult({
        success: false,
        message: err.message || 'PostFile upload test failed',
        testedAt: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsTestingPostFile(false);
    }
  };

  const handleSave = () => {
    onSaveSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSaveExtId = async () => {
    const clean = (extensionIdInput || '').trim();
    setExtensionId(clean);
    setExtSaveSuccess(true);
    setTimeout(() => setExtSaveSuccess(false), 2500);
    setIsCheckingExt(true);
    const res = await checkExtensionConnection(clean);
    setExtConnectionResult(res);
    setIsCheckingExt(false);
  };

  const handleCheckExtConnection = async () => {
    setIsCheckingExt(true);
    const res = await checkExtensionConnection((extensionIdInput || '').trim());
    setExtConnectionResult(res);
    setIsCheckingExt(false);
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      await downloadExtensionZip();
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleTestAndSaveToken = async () => {
    const cleanToken = (accessTokenInput || '').trim();
    if (!cleanToken) {
      setTokenErrorMessage('Please provide an access token');
      setTokenTestStatus('error');
      return;
    }

    setIsTestingToken(true);
    setTokenTestStatus('idle');
    setTokenErrorMessage('');

    try {
      const userAccount = await pinterestApi.fetchUserAccount(cleanToken);
      onSavePinterestAccount(userAccount);
      setFormData(prev => ({ ...prev, pinterestAccessToken: cleanToken }));
      onSaveSettings({ ...formData, pinterestAccessToken: cleanToken });
      setTokenTestStatus('success');
    } catch (err: any) {
      setTokenTestStatus('error');
      setTokenErrorMessage(err.message || 'Failed to verify Pinterest access token');
    } finally {
      setIsTestingToken(false);
    }
  };

  const handleDisconnect = () => {
    onSavePinterestAccount(null);
    setAccessTokenInput('');
    setFormData(prev => ({ ...prev, pinterestAccessToken: '' }));
    onSaveSettings({ ...formData, pinterestAccessToken: '' });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Settings & Preferences
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure Pinterest API keys, AI metadata pacing, dark mode, and workspace defaults.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1.5 bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-md shadow-red-200 dark:shadow-none"
        >
          {saveSuccess ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
          <span>{saveSuccess ? 'Saved Successfully!' : 'Save Settings'}</span>
        </button>
      </div>

      {/* 1. Theme / Appearance Tile */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Appearance & Theme</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Toggle between Light and Dark mode</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (isDarkMode && onToggleDarkMode) onToggleDarkMode();
            }}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all ${
              !isDarkMode
                ? 'border-[#E60023] bg-red-50/50 text-[#E60023] ring-2 ring-[#E60023]/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Light Mode</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isDarkMode && onToggleDarkMode) onToggleDarkMode();
            }}
            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold cursor-pointer transition-all ${
              isDarkMode
                ? 'border-[#E60023] bg-slate-800 text-red-400 ring-2 ring-[#E60023]/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            <Moon className="w-4 h-4 text-purple-400" />
            <span>Dark Mode</span>
          </button>
        </div>
      </div>

      {/* 2. AI Provider, Resiliency & Gemini Settings Tile */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/50 text-[#E60023] dark:text-red-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">AI Provider & Resilient Analysis Engine</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Configure primary AI provider, automatic Pollinations fallback, and smart retries</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" /> High-Availability Active
          </span>
        </div>

        {/* Provider Switcher Tabs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Active AI Provider
            </label>
            <span className="text-[11px] text-slate-400">
              Configure which AI engine analyzes your pins
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, aiProvider: 'groq' }))}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                (formData.aiProvider || 'groq') === 'groq'
                  ? 'border-[#E60023] bg-red-50/50 dark:bg-red-950/30 text-slate-900 dark:text-white ring-2 ring-[#E60023]/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">Groq AI</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E60023] text-white">Default</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Ultra-fast LPUs with GPT-OSS & Qwen models.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, aiProvider: 'openrouter' }))}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                formData.aiProvider === 'openrouter'
                  ? 'border-[#E60023] bg-red-50/50 dark:bg-red-950/30 text-slate-900 dark:text-white ring-2 ring-[#E60023]/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">OpenRouter</span>
                <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">Gateway</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Auto-routing to 100+ LLMs with vision.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, aiProvider: 'auto' }))}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                formData.aiProvider === 'auto'
                  ? 'border-[#E60023] bg-red-50/50 dark:bg-red-950/30 text-slate-900 dark:text-white ring-2 ring-[#E60023]/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">Auto Cascade</span>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Smart</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Groq ➔ OpenRouter ➔ Gemini ➔ Pollinations.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, aiProvider: 'custom' }))}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                formData.aiProvider === 'custom'
                  ? 'border-[#E60023] bg-red-50/50 dark:bg-red-950/30 text-slate-900 dark:text-white ring-2 ring-[#E60023]/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">Custom URL</span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Endpoint</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Connect your OpenAI-compatible endpoint.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, aiProvider: 'gemini' }))}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                formData.aiProvider === 'gemini'
                  ? 'border-[#E60023] bg-red-50/50 dark:bg-red-950/30 text-slate-900 dark:text-white ring-2 ring-[#E60023]/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">Google Gemini</span>
                <span className="text-[10px] font-semibold text-slate-400">Direct</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Official Gemini 3.5 Flash via verified API key.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, aiProvider: 'pollinations' }))}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                formData.aiProvider === 'pollinations'
                  ? 'border-[#E60023] bg-red-50/50 dark:bg-red-950/30 text-slate-900 dark:text-white ring-2 ring-[#E60023]/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-[#F7F7F9] dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black">Pollinations</span>
                <span className="text-[10px] font-semibold text-slate-400">Keyless</span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Free fallback vision and text generation.
              </p>
            </button>
          </div>
        </div>

        {/* Groq Settings Panel */}
        {(formData.aiProvider === 'groq' || !formData.aiProvider) && (
          <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-2xl border border-orange-200 dark:border-orange-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Groq AI Configuration (Ultra-Fast Pinterest Copy)
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200 px-2 py-0.5 rounded-full font-bold">
                500+ tokens/sec
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Groq Model
                </label>
                <select
                  value={formData.groqModel || 'openai/gpt-oss-120b'}
                  onChange={(e) => setFormData(prev => ({ ...prev, groqModel: e.target.value }))}
                  className="w-full text-xs font-semibold p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Recommended - Deep Pinterest Reasoning)</option>
                  <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Fast & Precise)</option>
                  <option value="openai/gpt-oss-20b">openai/gpt-oss-20b (Ultra-Fast)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Groq API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="gsk_..."
                    value={formData.groqApiKey ?? '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'}
                    onChange={(e) => setFormData(prev => ({ ...prev, groqApiKey: e.target.value }))}
                    className="flex-1 text-xs font-mono p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleTestGroq}
                    disabled={isTestingGroq}
                    className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isTestingGroq ? 'animate-spin' : ''}`} />
                    <span>{isTestingGroq ? 'Testing...' : 'Test Groq'}</span>
                  </button>
                </div>
              </div>
            </div>

            {groqTestResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  groqTestResult.success
                    ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                }`}
              >
                {groqTestResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="leading-relaxed">
                  <span className="font-bold">{groqTestResult.success ? 'Success: ' : 'Failed: '}</span>
                  <span>{groqTestResult.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OpenRouter Settings Panel */}
        {formData.aiProvider === 'openrouter' && (
          <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  OpenRouter AI Gateway
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded-full font-bold">
                Universal Gateway
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  OpenRouter Model
                </label>
                <input
                  type="text"
                  placeholder="openrouter/auto or meta-llama/llama-3.3-70b-instruct"
                  value={formData.openrouterModel || 'openrouter/auto'}
                  onChange={(e) => setFormData(prev => ({ ...prev, openrouterModel: e.target.value }))}
                  className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  OpenRouter API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={formData.openrouterApiKey ?? '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'}
                    onChange={(e) => setFormData(prev => ({ ...prev, openrouterApiKey: e.target.value }))}
                    className="flex-1 text-xs font-mono p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleTestOpenRouter}
                    disabled={isTestingOpenRouter}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isTestingOpenRouter ? 'animate-spin' : ''}`} />
                    <span>{isTestingOpenRouter ? 'Testing...' : 'Test OpenRouter'}</span>
                  </button>
                </div>
              </div>
            </div>

            {openRouterTestResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  openRouterTestResult.success
                    ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                }`}
              >
                {openRouterTestResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="leading-relaxed">
                  <span className="font-bold">{openRouterTestResult.success ? 'Success: ' : 'Failed: '}</span>
                  <span>{openRouterTestResult.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom AI API Endpoint Panel (Rendered whenever Custom is active or configured) */}
        {(formData.aiProvider === 'custom' || formData.customApiUrl) && (
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Custom AI API Endpoint Configuration
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full">
                OpenAI-Compatible
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  API Endpoint URL *
                </label>
                <input
                  type="text"
                  placeholder="https://api.openai.com/v1/chat/completions or https://your-proxy/v1/chat/completions"
                  value={formData.customApiUrl || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, customApiUrl: e.target.value }))}
                  className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Model Identifier
                </label>
                <input
                  type="text"
                  placeholder="gpt-4o, claude-3-5-sonnet, deepseek-chat..."
                  value={formData.customApiModel || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, customApiModel: e.target.value }))}
                  className="w-full text-xs font-mono p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                API Key / Bearer Token (Optional if proxy is unauthenticated)
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="sk-... or your custom bearer token"
                  value={formData.customApiKey || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, customApiKey: e.target.value }))}
                  className="flex-1 text-xs font-mono p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={handleTestCustomAi}
                  disabled={isTestingCustomAi || !formData.customApiUrl}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isTestingCustomAi ? 'animate-spin' : ''}`} />
                  <span>{isTestingCustomAi ? 'Testing Endpoint...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>

            {customAiTestResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  customAiTestResult.success
                    ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                }`}
              >
                {customAiTestResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="leading-relaxed">
                  <span className="font-bold">
                    {customAiTestResult.success ? 'Success: ' : 'Connection Issue: '}
                  </span>
                  <span>{customAiTestResult.message}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resiliency & Auto Retry Settings */}
        <div className="p-4 bg-[#F7F7F9] dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-[#E60023]" />
                Auto Retry on Overload / Timeout
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically retry failed requests before falling back or raising errors
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, autoRetry: !(prev.autoRetry ?? true) }))}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                (formData.autoRetry ?? true) ? 'bg-[#E60023]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  (formData.autoRetry ?? true) ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Max Retries per Provider
              </label>
              <select
                value={formData.maxRetries ?? 3}
                onChange={(e) => setFormData(prev => ({ ...prev, maxRetries: Number(e.target.value) || 3 }))}
                className="w-full text-xs font-semibold p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
              >
                <option value={1}>1 Attempt (No retries)</option>
                <option value={2}>2 Attempts</option>
                <option value={3}>3 Attempts (Recommended)</option>
                <option value={4}>4 Attempts</option>
                <option value={5}>5 Attempts</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Retry Delay (Seconds)
              </label>
              <input
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={(formData.retryDelay ? formData.retryDelay / 1000 : 2)}
                onChange={(e) => setFormData(prev => ({ ...prev, retryDelay: Math.round((Number(e.target.value) || 2) * 1000) }))}
                className="w-full text-xs font-semibold p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Request Timeout (Seconds)
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={(formData.timeout ? formData.timeout / 1000 : 20)}
                onChange={(e) => setFormData(prev => ({ ...prev, timeout: Math.round((Number(e.target.value) || 20) * 1000) }))}
                className="w-full text-xs font-semibold p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
              />
            </div>
          </div>
        </div>

        {/* Pacing & Language Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Hourglass className="w-3.5 h-3.5 text-slate-400" />
              Minimum Mass Delay (Seconds)
            </label>
            <input
              type="number"
              min={5}
              max={60}
              value={formData.aiMinDelaySeconds ?? 15}
              onChange={(e) => setFormData(prev => ({ ...prev, aiMinDelaySeconds: Number(e.target.value) || 15 }))}
              className="w-full text-xs font-semibold p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            />
            <p className="text-[10px] text-slate-400">Default: 15s between consecutive batch uploads</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Hourglass className="w-3.5 h-3.5 text-slate-400" />
              Maximum Mass Delay (Seconds)
            </label>
            <input
              type="number"
              min={10}
              max={120}
              value={formData.aiMaxDelaySeconds ?? 30}
              onChange={(e) => setFormData(prev => ({ ...prev, aiMaxDelaySeconds: Number(e.target.value) || 30 }))}
              className="w-full text-xs font-semibold p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            />
            <p className="text-[10px] text-slate-400">Default: 30s maximum random jitter</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-slate-400" />
              AI Output Language
            </label>
            <select
              value={formData.aiLanguage || 'English'}
              onChange={(e) => setFormData(prev => ({ ...prev, aiLanguage: e.target.value }))}
              className="w-full text-xs font-semibold p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Italian">Italian</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Japanese">Japanese</option>
              <option value="Arabic">Arabic</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              Gemini Vision Model
            </label>
            <select
              value={formData.aiModel || 'gemini-3.5-flash-lite'}
              onChange={(e) => setFormData(prev => ({ ...prev, aiModel: e.target.value }))}
              className="w-full text-xs font-semibold p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            >
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Ultra-Fast & High Reliability - Recommended)</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Comprehensive Reasoning)</option>
              <option value="gemini-flash-latest">Gemini Flash Latest</option>
            </select>
          </div>
        </div>

        {/* Default Custom AI Prompt */}
        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#E60023]" />
              <span>Default AI Prompt / Topic Guidance (التعليمات المخصصة الافتراضية لبناء العنوان والوصف)</span>
            </label>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              Optional workspace default
            </span>
          </div>
          <textarea
            rows={2}
            value={formData.aiCustomPrompt || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, aiCustomPrompt: e.target.value }))}
            placeholder="اكتب هنا ما تريد أن يعتمد عليه الـ AI دائماً (مثال: ركز على أفكار الديكور المودرن وتنسيق الغرف، أسلوب شيق وجذاب، كلمات مفتاحية عن الراحة والجمال)..."
            className="w-full text-xs font-normal p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E60023]/20 resize-y leading-relaxed"
          />
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            When configured, any newly queued pins will automatically inherit this prompt unless customized individually.
          </p>
        </div>
      </div>

      {/* 3. Pinterest API Connection Bento Tile */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/50 text-[#E60023] dark:text-red-400 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Pinterest API Connection</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Real Pinterest API v5 connection using environment variable or direct token</p>
            </div>
          </div>

          {pinterestAccount?.isConnected ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> Pinterest Connected ✓
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full">
              Disconnected
            </span>
          )}
        </div>

        {pinterestAccount?.isConnected ? (
          <div className="p-4 bg-[#F7F7F9] dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pinterestAccount.avatarUrl ? (
                <img
                  src={pinterestAccount.avatarUrl}
                  alt={pinterestAccount.username}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#E60023] text-white flex items-center justify-center font-bold">
                  {pinterestAccount.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">@{pinterestAccount.username}</h4>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  Account ID: {pinterestAccount.accountId} • Connected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestAndSaveToken}
                disabled={isTestingToken}
                className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1"
              >
                <RotateCw className={`w-3 h-3 ${isTestingToken ? 'animate-spin' : ''}`} />
                <span>Re-verify</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-medium">
              <p>
                <strong>Environment Variable Setup:</strong> Set <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200">PINTEREST_ACCESS_TOKEN</code> in your environment variables, or enter your token below.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pinterest Access Token (Optional Manual Input)</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={accessTokenInput}
                  onChange={(e) => setAccessTokenInput(e.target.value)}
                  placeholder="Leave empty to use PINTEREST_ACCESS_TOKEN from environment..."
                  className="flex-1 text-xs font-mono p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
                />
                <button
                  type="button"
                  onClick={handleTestAndSaveToken}
                  disabled={isTestingToken}
                  className="bg-[#E60023] hover:bg-[#ad001a] text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isTestingToken ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Test & Connect</span>
                  )}
                </button>
              </div>
            </div>

            {tokenTestStatus === 'error' && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Connection Failed: </span>
                  <span>{tokenErrorMessage}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3.5. Companion Chrome Extension Bento Tile */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Puzzle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Pinterest Publishing Assistant Extension</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Manifest V3 companion extension for automated field filling during manual publishing</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
            className="flex items-center gap-1.5 bg-[#F7F7F9] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
          >
            <Download className="w-3.5 h-3.5 text-amber-500" />
            <span>{isDownloadingZip ? 'Downloading...' : 'Download Extension (.ZIP)'}</span>
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-slate-400" />
            <span>Pinterest Extension ID</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={extensionIdInput}
              onChange={(e) => setExtensionIdInput(e.target.value)}
              placeholder="e.g. abcdefghijklmnopqrstuvwxyzabcdef (copied from chrome://extensions)"
              className="flex-1 text-xs font-mono p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <button
              type="button"
              onClick={handleSaveExtId}
              className="bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
            >
              {extSaveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
              <span>{extSaveSuccess ? 'Saved!' : 'Save ID'}</span>
            </button>
            <button
              type="button"
              onClick={handleCheckExtConnection}
              disabled={isCheckingExt || !(extensionIdInput || '').trim()}
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 ${isCheckingExt ? 'animate-ping' : ''}`} />
              <span>{isCheckingExt ? 'Checking...' : 'Test PING'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Open <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">chrome://extensions</code>, enable Developer mode, load unpacked extension, and copy the assigned 32-character ID.
          </p>

          {extConnectionResult && (
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 mt-2 ${
              extConnectionResult.connected 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {extConnectionResult.connected ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>
                  {extConnectionResult.connected 
                    ? `Extension heartbeat verified! Version: ${extConnectionResult.version || '1.0.0'} (${extConnectionResult.roundTripMs ?? 10}ms)` 
                    : (extConnectionResult.errorMessage || 'Failed to establish connection with extension.')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3.8. PostFile Cloud Storage & CDN API Tile */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-blue-200/80 dark:border-blue-900/60 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">PostFile Cloud Storage & CDN API</h2>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  Primary Storage
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Direct high-speed public CDN storage for eBook PDFs and Pinterest pin images
              </p>
            </div>
          </div>

          <a
            href="https://postfile.net"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
          >
            <span>postfile.net</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl text-xs text-blue-900 dark:text-blue-200 space-y-1.5 leading-relaxed">
          <p>
            PostFile generates direct, public, high-speed HTTPS download links (<code>https://cdn.postfile.download/...</code>). These URLs are fully verified and ready for Pinterest Bulk Upload, Google Sheets, Excel XLSX exports, and instant streaming.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-500" />
              <span>PostFile API Key (X-API-Key)</span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Manual key override or preconfigured active key
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={postFileKeyInput}
              onChange={(e) => setPostFileKeyInput(e.target.value)}
              placeholder="pf_..."
              className="flex-1 text-xs font-mono p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePostFileKey}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
              >
                {postFileSaveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{postFileSaveSuccess ? 'Saved!' : 'Save Key'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestPostFileUpload}
                disabled={isTestingPostFile || !(postFileKeyInput || '').trim()}
                className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50 border border-slate-700"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isTestingPostFile ? 'animate-spin' : ''}`} />
                <span>{isTestingPostFile ? 'Testing...' : 'Test Upload'}</span>
              </button>
            </div>
          </div>

          {postFileTestResult && (
            <div
              className={`p-3 rounded-2xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-2 ${
                postFileTestResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {postFileTestResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>{postFileTestResult.message}</span>
              </div>

              {postFileTestResult.url && (
                <a
                  href={postFileTestResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono font-semibold underline text-blue-600 dark:text-blue-400 shrink-0 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Test PDF</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Scheduling & Defaults Bento Tile */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/50 text-[#E60023] dark:text-red-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Publishing Defaults & Timezone</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Default boards and time slots for auto-scheduler</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Publishing Timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full text-xs font-semibold p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris / Berlin (CET)</option>
              <option value="UTC">UTC Universal</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Default Target Board</label>
            <select
              value={formData.defaultBoardId || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultBoardId: e.target.value }))}
              className="w-full text-xs font-semibold p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            >
              <option value="">No Default Board</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Default Website URL</label>
            <select
              value={formData.defaultWebsiteId || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultWebsiteId: e.target.value }))}
              className="w-full text-xs font-semibold p-2.5 bg-[#F7F7F9] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E60023]/20"
            >
              <option value="">No Default Website</option>
              {websites.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.url})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 5. Danger Zone */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-rose-200 dark:border-rose-900/60 shadow-sm space-y-4 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200">Database & State Management</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Actions for database maintenance and local cleanup</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClearAllPins}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            Clear All Pins
          </button>
          <button
            type="button"
            onClick={onResetAllData}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            Reset All Sample Data
          </button>
        </div>
      </div>
    </div>
  );
};
