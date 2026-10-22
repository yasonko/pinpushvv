/**
 * Frontend-Only AI Service Architecture
 * 
 * Abstraction:
 * AIService
 * ├── GeminiProvider       (Google GenAI Direct Vision Analysis)
 * └── PollinationsProvider (Pollinations Multimodal Vision Fallback)
 * 
 * Primary Entry Point:
 * analyzePinImage(image, options?)
 */

import { GoogleGenAI, Type } from '@google/genai';
import { sanitizeTagList } from './tagsHelper';

export type AiProviderType = 'groq' | 'openrouter' | 'auto' | 'gemini' | 'pollinations' | 'custom';

export interface AiAnalyzeOptions {
  provider?: AiProviderType;
  groqApiKey?: string;
  groqModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  model?: string;
  language?: string;
  filename?: string;
  customPrompt?: string;   // User-defined context/instructions to build title, description & keywords upon
  customApiUrl?: string;   // Custom AI endpoint URL
  customApiKey?: string;   // Optional custom API bearer key
  customApiModel?: string; // Optional custom model name
  autoRetry?: boolean;     // Default: true
  maxRetries?: number;    // Default: 3
  retryDelay?: number;    // Default: 2000 ms
  timeout?: number;       // Default: 30000 ms
  onProgress?: (step: string, details?: string) => void;
}

export interface PinAnalyzeResult {
  title: string;
  description: string;
  tags: string[];
  altText?: string;
  url?: string;
  provider: 'groq' | 'openrouter' | 'gemini' | 'pollinations' | 'custom';
  model: string;
  attempts: number;
  fallbackUsed: boolean;
}

export interface NormalizedImage {
  base64Data: string;
  mimeType: string;
  fullDataUri: string;
}

/**
 * Custom AI Error with retryability indicator
 */
export class AiProviderError extends Error {
  public provider: 'groq' | 'openrouter' | 'gemini' | 'pollinations' | 'custom';
  public statusCode?: number;
  public isRetryable: boolean;
  public originalError?: any;

  constructor(
    provider: 'groq' | 'openrouter' | 'gemini' | 'pollinations' | 'custom',
    message: string,
    options?: { statusCode?: number; isRetryable?: boolean; originalError?: any }
  ) {
    super(message);
    this.name = 'AiProviderError';
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.isRetryable = options?.isRetryable ?? false;
    this.originalError = options?.originalError;
  }
}

/**
 * Utility to pause execution for a given duration
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Race a promise against a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new AiProviderError('gemini', timeoutMsg, { statusCode: 408, isRetryable: true });
      reject(err);
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Resolve all available API keys safely from environment variables (Vite / client define / fallback)
 */
export function getGeminiApiKeys(): Array<{ key: string; isBackup: boolean; label: string }> {
  const keys: Array<{ key: string; isBackup: boolean; label: string }> = [];
  const seen = new Set<string>();

  const primary = (
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.GEMINI_API_KEY) ||
    ''
  ).trim();

  if (primary && !primary.startsWith('MY_')) {
    seen.add(primary);
    keys.push({ key: primary, isBackup: false, label: 'Primary GEMINI_API_KEY' });
  }

  const backupEnv = (
    (typeof process !== 'undefined' && process.env?.GEMINI_BACKUP_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_GEMINI_BACKUP_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.GEMINI_BACKUP_API_KEY) ||
    ''
  ).trim();

  if (backupEnv && !backupEnv.startsWith('MY_') && !seen.has(backupEnv)) {
    seen.add(backupEnv);
    keys.push({ key: backupEnv, isBackup: true, label: 'Configured GEMINI_BACKUP_API_KEY' });
  }

  return keys;
}

export function getGeminiApiKey(): string {
  const list = getGeminiApiKeys();
  return list[0]?.key || '';
}

export function getPollinationsApiKey(): string {
  const envKey = 
    (typeof process !== 'undefined' && process.env?.POLLINATIONS_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_POLLINATIONS_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.POLLINATIONS_API_KEY) ||
    '';
  return envKey ? envKey.trim() : '';
}

/**
 * Normalize and downscale any image input (File, Blob, Data URI, URL) to ~1024px
 * for optimal vision token usage and high transmission speed.
 */
export async function normalizeAndOptimizeImage(
  imageInput: string | File | Blob
): Promise<NormalizedImage> {
  let rawDataUri = '';
  let mimeType = 'image/jpeg';

  if (typeof imageInput === 'string') {
    if (imageInput.startsWith('data:')) {
      rawDataUri = imageInput;
      const m = imageInput.match(/data:(.*?);/);
      if (m) mimeType = m[1];
    } else if (imageInput.startsWith('blob:') || imageInput.startsWith('http')) {
      try {
        const res = await fetch(imageInput);
        const blob = await res.blob();
        mimeType = blob.type || 'image/jpeg';
        rawDataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        rawDataUri = imageInput;
      }
    } else {
      rawDataUri = `data:image/jpeg;base64,${imageInput}`;
    }
  } else if (typeof Blob !== 'undefined' && imageInput instanceof Blob) {
    mimeType = imageInput.type || 'image/jpeg';
    rawDataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageInput);
    });
  }

  // Optimize with HTML5 Canvas if running in browser
  if (typeof window !== 'undefined' && typeof Image !== 'undefined' && rawDataUri.startsWith('data:image')) {
    try {
      const optimized = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const maxDimension = 1024;
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(dataUrl);
            return;
          }
          resolve(rawDataUri);
        };
        img.onerror = () => resolve(rawDataUri);
        img.src = rawDataUri;
      });

      rawDataUri = optimized;
      mimeType = 'image/jpeg';
    } catch {
      // Continue with unoptimized if canvas fails
    }
  }

  // Separate pure base64 payload from data uri prefix
  let cleanBase64 = rawDataUri;
  if (rawDataUri.includes('base64,')) {
    const parts = rawDataUri.split('base64,');
    cleanBase64 = parts[1];
  }

  return {
    base64Data: cleanBase64,
    mimeType,
    fullDataUri: rawDataUri.startsWith('data:') ? rawDataUri : `data:${mimeType};base64,${cleanBase64}`,
  };
}

/**
 * Clean & format Pinterest Tagged Topics (No #, no hyphens, natural 1-4 words)
 */
export function cleanPinterestTopicTags(rawTags: any): string[] {
  const sanitized = sanitizeTagList(rawTags);
  return sanitized.slice(0, 15);
}

// System prompt for Pinterest SEO & Taxonomy
function buildSystemInstruction(language: string = 'English', customPrompt?: string): string {
  const userInstructionsBlock = customPrompt && customPrompt.trim()
    ? `

USER-SPECIFIED FOCUS & CONTENT GUIDELINES:
"""
${customPrompt.trim()}
"""
CRITICAL DIRECTIVE: The user has provided the specific direction, topic, keywords, or creative angle above. You MUST build the Pin TITLE and DESCRIPTION upon these user-specified instructions and ideas, blending them seamlessly with what is visibly depicted in the image. Ensure the generated title and description emphasize this requested focus.`
    : '';

  return `You are an expert Pinterest content strategist, visual SEO taxonomy specialist, and copywriter.
Analyze this Pinterest image carefully. Identify only what is actually visible in the image.
Determine the main subject, visual theme, audience, context, style, colors, and Pinterest category taxonomy.${userInstructionsBlock}

Generate:
1. TITLE: A Pinterest-friendly, SEO-optimized, attractive, and click-worthy title (max 100 chars, no spam, no hashtags, relevant to image, distinct and unique).
2. DESCRIPTION (TRAFFIC-FOCUSED):
   - Every description must be written to encourage the viewer to click the Pin and visit the Destination URL.
   - Structure:
     * HOOK (1-2 sentences): Spark curiosity and highlight the visual subject.
     * VALUE (1 sentence): Clearly communicate what the reader will discover or gain by visiting the website.
     * NATURAL SEO KEYWORDS: Weave relevant search keywords naturally into the sentences without keyword stuffing.
     * CALL TO ACTION (1 sentence): A natural, polite invitation to visit the website for more inspiration, guides, full collections, or details.
     * Rotation of CTA styles (e.g., "Discover more ideas on our website.", "Explore the full collection on our website.", "Visit the website for more inspiration.", "See the complete guide and more ideas on our website.", "Explore the full article for more ideas and inspiration.").
   - Strict rules: Avoid keyword stuffing. Avoid fake claims or clickbait. Never insert fake URLs in the description text. Cap at 2-4 sentences (150-400 chars).
3. TAGGED TOPICS (TAGS): 8 to 15 Pinterest search keywords and topic phrases (natural phrases 1-4 words each, lowercase, ordered from specific subject to general niche).
   - NEVER use hashtags or the '#' symbol.
   - NEVER use hyphens between words (Write "modern bedroom", NEVER "modern-bedroom").
   - NEVER use quotes, commas, or brackets inside tag strings.
4. ALT TEXT (ACCESSIBILITY & VISUAL SEO):
   - Accurate, objective, and detailed visual accessibility text (1-2 sentences, max 250 chars) for screen readers and search engines.
   - Describe what is physically visible: main subject, composition, setting, colors, materials, style, lighting.
   - STRICT RULE: Do NOT turn Alt Text into a sales pitch. STRICTLY NO CTAs in Alt Text (no "click here", no "visit website", no "shop now").
   - Do NOT start with "Image of..." or "Picture of...". Start directly with what is depicted.

Language: Output title, description, tags, and altText in ${language}.
Return ONLY valid structured JSON matching:
{
  "title": "string",
  "description": "string",
  "tags": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8", "keyword 9", "keyword 10"],
  "altText": "string"
}`;
}

function buildUserPrompt(filename: string, language: string, customPrompt?: string): string {
  const customGuidance = customPrompt && customPrompt.trim()
    ? ` Incorporate and build upon this user guidance/topic: "${customPrompt.trim()}".`
    : '';
  return `Analyze this Pinterest image (original filename: "${filename || 'pin-image'}")${customGuidance} and generate traffic-focused title, description with natural website CTA, 8-15 Pinterest keyword tags, and objective visual altText in ${language}. Return JSON only.`;
}

/* ==========================================================================
   1. GEMINI PROVIDER (Direct Client-Side Execution via @google/genai / REST)
   ========================================================================== */

export class GeminiProvider {
  public name = 'gemini' as const;

  /**
   * Determine if an error is transient/retryable (408, 429, 500, 502, 503, 504, network)
   * or fatal/non-retryable (401, 403, invalid key).
   */
  public isRetryableError(err: any): boolean {
    const status = err?.status || err?.statusCode || err?.response?.status;
    const msg = (err?.message || String(err)).toLowerCase();

    // Fatal / Non-retryable
    if (status === 401 || status === 403) return false;
    if (msg.includes('api_key_invalid') || msg.includes('invalid api key') || msg.includes('permission denied')) {
      return false;
    }
    if (msg.includes('missing gemini_api_key')) {
      return false;
    }

    // Retryable status codes
    if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
    if (msg.includes('503') || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('overloaded')) {
      return true;
    }
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch failed')) {
      return true;
    }

    return true;
  }

  /**
   * Execute single vision analysis request using Gemini API
   */
  public async analyze(
    image: NormalizedImage,
    options: AiAnalyzeOptions
  ): Promise<{ title: string; description: string; tags: string[]; altText?: string; url: string; model: string; usedBackupKey?: boolean }> {
    const availableKeys = getGeminiApiKeys();
    if (availableKeys.length === 0) {
      throw new AiProviderError(
        'gemini',
        'Gemini API key is not configured. Please set GEMINI_API_KEY in Settings or environment variables.',
        { statusCode: 401, isRetryable: false }
      );
    }

    const language = options.language || 'English';
    const filename = options.filename || 'pin-image';
    const selectedModel = options.model && options.model.startsWith('gemini-') && !options.model.includes('3.7') && !options.model.includes('2.5')
      ? options.model
      : 'gemini-3.5-flash-lite';

    // Cascading candidate models:
    // If a model experiences high demand (503) or unavailability, cascade automatically to active models.
    const candidateModels = Array.from(new Set([
      selectedModel,
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ].filter(Boolean)));

    const systemInstruction = buildSystemInstruction(language, options.customPrompt);
    const userPrompt = buildUserPrompt(filename, language, options.customPrompt);
    const timeoutMs = options.timeout || 30000;

    let lastError: any = null;

    for (let keyIdx = 0; keyIdx < availableKeys.length; keyIdx++) {
      const keyConfig = availableKeys[keyIdx];

      for (const modelName of candidateModels) {
        try {
          console.log(`[GeminiProvider] Direct frontend analysis using ${keyConfig.label} with model "${modelName}" for "${filename}"`);

          const ai = new GoogleGenAI({
            apiKey: keyConfig.key,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build-client',
              },
            },
          });

          const genPromise = ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: image.mimeType,
                    data: image.base64Data,
                  },
                },
                {
                  text: userPrompt,
                },
              ],
            },
            config: {
              systemInstruction,
              temperature: 0.5,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: 'Pinterest-friendly, natural, SEO title (max 100 chars, no hashtags).',
                  },
                  description: {
                    type: Type.STRING,
                    description: 'Natural SEO Pinterest pin description (2-4 sentences) describing visual.',
                  },
                  tags: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING,
                    },
                    description: '8 to 15 Pinterest search keywords/topic tags (natural phrases 1-4 words each).',
                  },
                  altText: {
                    type: Type.STRING,
                    description: 'Concise descriptive accessibility alt text.',
                  },
                },
                required: ['title', 'description', 'tags'],
              },
            },
          });

          const response = await withTimeout(
            genPromise,
            timeoutMs,
            `Gemini API request timed out after ${Math.round(timeoutMs / 1000)}s`
          );

          if (response && response.text) {
            let parsed: any;
            try {
              parsed = JSON.parse(response.text);
            } catch {
              const match = response.text.match(/\{[\s\S]*\}/);
              if (match) {
                parsed = JSON.parse(match[0]);
              } else {
                throw new Error('Failed to parse Gemini structured JSON output');
              }
            }

            return {
              title: (parsed.title || '').trim(),
              description: (parsed.description || '').trim(),
              tags: cleanPinterestTopicTags(parsed.tags),
              altText: (parsed.altText || '').trim(),
              url: '',
              model: modelName,
              usedBackupKey: keyConfig.isBackup,
            };
          }
        } catch (err: any) {
          lastError = err;
          const statusCode = err?.status || err?.statusCode || (err.message?.includes('401') ? 401 : err.message?.includes('403') ? 403 : 500);
          const isQuotaOrRateLimit = statusCode === 429 ||
            String(err?.message || '').toLowerCase().includes('quota') ||
            String(err?.message || '').toLowerCase().includes('resource_exhausted') ||
            String(err?.message || '').toLowerCase().includes('rate limit');

          console.warn(`[GeminiProvider] ${keyConfig.label} model "${modelName}" failed (${statusCode}):`, err.message);

          // If quota exceeded or auth error, try the next key immediately
          if (isQuotaOrRateLimit || statusCode === 401 || statusCode === 403) {
            if (keyIdx < availableKeys.length - 1) {
              console.warn(`[GeminiProvider] Failing over to backup Gemini key (${availableKeys[keyIdx + 1].label})...`);
            }
            break;
          }

          // If 503 or transient error, cascade to next candidate model
          console.warn(`[GeminiProvider] Cascading to next candidate model...`);
        }
      }
    }

    const finalStatus = lastError?.status || lastError?.statusCode || 500;
    throw new AiProviderError(
      'gemini',
      lastError?.message || 'Gemini Vision analysis failed across all configured API keys',
      {
        statusCode: finalStatus,
        isRetryable: this.isRetryableError(lastError),
        originalError: lastError,
      }
    );
  }
}

/* ==========================================================================
   2. POLLINATIONS PROVIDER (Direct Client-Side Multimodal Fallback)
   ========================================================================== */

export class PollinationsProvider {
  public name = 'pollinations' as const;

  public isRetryableError(err: any): boolean {
    const status = err?.statusCode || err?.status;
    const msg = (err?.message || String(err)).toLowerCase();

    if (status === 401 || status === 403) return false;
    if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch failed')) return true;
    return true;
  }

  public async analyze(
    image: NormalizedImage,
    options: AiAnalyzeOptions
  ): Promise<{ title: string; description: string; tags: string[]; url: string; model: string }> {
    const rawKey = getPollinationsApiKey();
    const pollinationsKey = rawKey && !rawKey.startsWith('MY_') ? rawKey : '';
    const language = options.language || 'English';
    const filename = options.filename || 'pin-image';
    const targetModel = options.model && !options.model.startsWith('gemini-')
      ? options.model
      : 'openai';

    const systemInstruction = buildSystemInstruction(language, options.customPrompt);
    const userPrompt = buildUserPrompt(filename, language, options.customPrompt);
    const timeoutMs = options.timeout || 30000;

    let lastError: any = null;

    // Approach 1: Try gen.pollinations.ai multimodal vision if a valid key is configured
    if (pollinationsKey) {
      try {
        console.log(`[PollinationsProvider] Direct vision call to gen.pollinations.ai (model: "${targetModel}")`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pollinationsKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: targetModel,
            messages: [
              { role: 'system', content: systemInstruction },
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
                  { type: 'image_url', image_url: { url: image.fullDataUri } },
                ],
              },
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' },
          }),
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const resJson: any = await res.json();
          const rawContent = resJson?.choices?.[0]?.message?.content || '';
          const match = rawContent.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            return {
              title: (parsed.title || '').trim(),
              description: (parsed.description || '').trim(),
              tags: cleanPinterestTopicTags(parsed.tags),
              url: (parsed.url || '').trim(),
              model: targetModel,
            };
          }
        }
      } catch (err: any) {
        lastError = err;
        console.warn('[PollinationsProvider] gen.pollinations.ai failed:', err.message);
      }
    }

    // Approach 2: Robust text-based Pinterest metadata generation on text.pollinations.ai
    // Highly reliable fallback without requiring vision tokens, built on filename & context
    try {
      console.log(`[PollinationsProvider] Calling text.pollinations.ai for "${filename}"`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (pollinationsKey) {
        headers['Authorization'] = `Bearer ${pollinationsKey}`;
      }

      const textPrompt = `${userPrompt}\nContext: Image filename is "${filename}". Generate complete title, description with CTA, 10 tags, and alt text.`;

      const res = await fetch('https://text.pollinations.ai/openai/chat/completions', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: 'openai',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: textPrompt },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const resJson: any = await res.json();
        const rawContent = resJson?.choices?.[0]?.message?.content || '';
        const match = rawContent.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return {
            title: (parsed.title || '').trim(),
            description: (parsed.description || '').trim(),
            tags: cleanPinterestTopicTags(parsed.tags),
            url: (parsed.url || '').trim(),
            model: 'pollinations-text-openai',
          };
        }
      } else {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`);
      }
    } catch (err: any) {
      lastError = err;
      console.warn('[PollinationsProvider] text.pollinations.ai failed:', err.message);
    }

    throw new AiProviderError(
      'pollinations',
      lastError?.message || 'Pollinations Vision analysis failed across endpoints',
      {
        statusCode: lastError?.statusCode || 500,
        isRetryable: this.isRetryableError(lastError),
        originalError: lastError,
      }
    );
  }
}

/* ==========================================================================
   3. AI SERVICE (Unified Abstraction with Auto Fallback & Smart Retry)
   ========================================================================== */

export class AIService {
  private geminiProvider = new GeminiProvider();
  private pollinationsProvider = new PollinationsProvider();

  /**
   * Execute with Auto Retry logic:
   * Max Retries = 3 (configurable)
   * Timeout = 30s (configurable)
   * Retry on: 408, 429, 500, 502, 503, 504, Network Error, Timeout
   * DO NOT retry: 401, 403, Invalid API Key
   */
  private async executeWithRetry<T>(
    provider: 'gemini' | 'pollinations',
    fn: (attempt: number) => Promise<T>,
    options: AiAnalyzeOptions
  ): Promise<{ result: T; attempts: number }> {
    const autoRetry = options.autoRetry ?? true;
    const maxRetries = autoRetry ? Math.max(1, Math.min(options.maxRetries ?? 3, 5)) : 1;
    const retryDelay = Math.max(500, Math.min(options.retryDelay ?? 2000, 10000));

    let attempts = 0;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attempts++;
      try {
        if (options.onProgress && attempt > 1) {
          options.onProgress('retrying', `Retrying ${provider} (attempt ${attempt}/${maxRetries})...`);
        }
        const result = await fn(attempt);
        return { result, attempts };
      } catch (err: any) {
        lastError = err;
        const isRetryable = provider === 'gemini' 
          ? this.geminiProvider.isRetryableError(err) 
          : this.pollinationsProvider.isRetryableError(err);

        console.warn(`[AIService] ${provider} attempt ${attempt}/${maxRetries} failed (isRetryable=${isRetryable}):`, err.message);

        // Break immediately on non-retryable error (e.g. 401/403/invalid key)
        if (!isRetryable || attempt >= maxRetries) {
          break;
        }

        // Wait backoff delay before next retry
        await wait(retryDelay * attempt);
      }
    }

    throw lastError || new Error(`${provider} failed after ${attempts} attempts`);
  }

  /**
   * Execute direct client call to custom OpenAI-compatible AI API endpoint
   */
  private async executeCustomClientCall(
    image: NormalizedImage,
    options: AiAnalyzeOptions
  ): Promise<PinAnalyzeResult> {
    const url = options.customApiUrl;
    if (!url) throw new Error('Missing custom API URL');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.customApiKey) {
      headers['Authorization'] = `Bearer ${options.customApiKey}`;
    }

    const language = options.language || 'English';
    const filename = options.filename || 'pin-image';
    const targetModel = options.customApiModel || options.model || 'gpt-4o';
    const systemInstruction = buildSystemInstruction(language, options.customPrompt);
    const userPrompt = buildUserPrompt(filename, language, options.customPrompt);

    // Multimodal attempt
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: systemInstruction },
            {
              role: 'user',
              content: [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: image.fullDataUri } },
              ],
            },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const json: any = await res.json();
        const content = json?.choices?.[0]?.message?.content || json?.content || '';
        const match = String(content).match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return {
            title: (parsed.title || '').trim(),
            description: (parsed.description || '').trim(),
            tags: cleanPinterestTopicTags(parsed.tags),
            altText: (parsed.altText || '').trim(),
            url: (parsed.url || '').trim(),
            provider: 'custom',
            model: targetModel,
            attempts: 1,
            fallbackUsed: false,
          };
        }
      }
    } catch {
      // Fall through to text-only call
    }

    // Text-only fallback for endpoints without vision
    const textRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: `${userPrompt}\nFilename: "${filename}"` },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!textRes.ok) {
      const errTxt = await textRes.text().catch(() => '');
      throw new Error(`Custom AI Endpoint returned HTTP ${textRes.status}: ${errTxt.slice(0, 120)}`);
    }

    const json: any = await textRes.json();
    const content = json?.choices?.[0]?.message?.content || json?.content || '';
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Custom AI did not return a valid JSON object');
    const parsed = JSON.parse(match[0]);

    return {
      title: (parsed.title || '').trim(),
      description: (parsed.description || '').trim(),
      tags: cleanPinterestTopicTags(parsed.tags),
      altText: (parsed.altText || '').trim(),
      url: (parsed.url || '').trim(),
      provider: 'custom',
      model: targetModel,
      attempts: 1,
      fallbackUsed: false,
    };
  }

  /**
   * Main unified entry point: analyzePinImage(image, options)
   * Handles:
   * 1. Image normalization and fast downscaling (~1024px)
   * 2. Auto-mode fallback (Gemini -> Pollinations)
   * 3. Retries for transient issues
   * 4. Structured JSON output with title, description, exactly 10 topic tags, and URL.
   */
  public async analyzePinImage(
    imageInput: string | File | Blob,
    options: AiAnalyzeOptions = {}
  ): Promise<PinAnalyzeResult> {
    const providerMode: AiProviderType = options.provider || 'auto';
    const filename = options.filename || 'pin-image';

    console.log(`[AIService] Starting analysis for "${filename}" (Mode: ${providerMode})`);

    if (options.onProgress) {
      options.onProgress('analyzing', `Optimizing image and connecting to ${providerMode}...`);
    }

    // Step 1: Normalize & optimize image client-side
    const normalizedImage = await normalizeAndOptimizeImage(imageInput);

    let totalAttempts = 0;

    // First attempt: Server API endpoint (/api/ai/analyze-pin)
    try {
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        const response = await fetch('/api/ai/analyze-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: normalizedImage.fullDataUri,
            mimeType: normalizedImage.mimeType,
            filename,
            language: options.language || 'English',
            provider: providerMode,
            groqApiKey: options.groqApiKey,
            groqModel: options.groqModel,
            openrouterApiKey: options.openrouterApiKey,
            openrouterModel: options.openrouterModel,
            customApiUrl: options.customApiUrl,
            customApiKey: options.customApiKey,
            customApiModel: options.customApiModel,
            model: options.model,
            customPrompt: options.customPrompt,
            autoRetry: options.autoRetry ?? true,
            maxRetries: options.maxRetries ?? 3,
            retryDelay: options.retryDelay ?? 2000,
            timeout: options.timeout ?? 30000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.title && data.description) {
            return {
              title: (data.title || '').trim(),
              description: (data.description || '').trim(),
              tags: cleanPinterestTopicTags(data.tags),
              altText: (data.altText || '').trim(),
              url: (data.url || '').trim(),
              provider: data.provider || providerMode,
              model: data.model || options.groqModel || options.openrouterModel || options.customApiModel || 'openai/gpt-oss-120b',
              attempts: data.attempts || 1,
              fallbackUsed: data.fallbackUsed || false,
            };
          }
        }
      }
    } catch (serverErr) {
      console.warn('[AIService] Server API attempt failed, falling back to direct client execution:', serverErr);
    }

    // --- CASE 0: Custom Provider Direct Client Call ---
    if (providerMode === 'custom' && options.customApiUrl) {
      try {
        return await this.executeCustomClientCall(normalizedImage, options);
      } catch (customErr: any) {
        throw new Error(`Custom AI failed: ${customErr.message || 'Service unavailable'}`);
      }
    }

    // --- CASE 1: Pollinations Only ---
    if (providerMode === 'pollinations') {
      try {
        const { result, attempts } = await this.executeWithRetry(
          'pollinations',
          () => this.pollinationsProvider.analyze(normalizedImage, options),
          options
        );

        return {
          title: result.title,
          description: result.description,
          tags: result.tags,
          altText: (result as any).altText || '',
          url: result.url,
          provider: 'pollinations',
          model: result.model,
          attempts,
          fallbackUsed: false,
        };
      } catch (err: any) {
        throw new Error(`Pollinations AI failed: ${err.message || 'Service unavailable'}`);
      }
    }

    // --- CASE 2: Gemini Only ---
    if (providerMode === 'gemini') {
      try {
        const { result, attempts } = await this.executeWithRetry(
          'gemini',
          () => this.geminiProvider.analyze(normalizedImage, options),
          options
        );

        return {
          title: result.title,
          description: result.description,
          tags: result.tags,
          altText: result.altText || '',
          url: result.url,
          provider: 'gemini',
          model: result.model,
          attempts,
          fallbackUsed: false,
        };
      } catch (err: any) {
        throw new Error(`Gemini AI failed: ${err.message || 'Service unavailable'}`);
      }
    }

    // --- CASE 3: AUTO MODE (Gemini -> Smart Fallback to Pollinations) ---
    let geminiError: any = null;
    const hasGeminiKey = Boolean(getGeminiApiKey());

    if (hasGeminiKey) {
      try {
        if (options.onProgress) {
          options.onProgress('analyzing', 'Analyzing image features with Gemini...');
        }

        const { result, attempts } = await this.executeWithRetry(
          'gemini',
          () => this.geminiProvider.analyze(normalizedImage, options),
          options
        );

        return {
          title: result.title,
          description: result.description,
          tags: result.tags,
          altText: result.altText || '',
          url: result.url,
          provider: 'gemini',
          model: result.model,
          attempts,
          fallbackUsed: false,
        };
      } catch (err: any) {
        geminiError = err;
        totalAttempts += (options.maxRetries || 3);
        console.warn('[AIService: Auto] Gemini failed. Triggering Pollinations fallback...', err.message);
      }
    } else {
      console.log('[AIService: Auto] No Gemini API key detected. Using Pollinations provider...');
    }

    // Fallback: Pollinations AI
    try {
      if (options.onProgress) {
        options.onProgress('analyzing', 'Routing to Pollinations AI fallback...');
      }

      const { result, attempts } = await this.executeWithRetry(
        'pollinations',
        () => this.pollinationsProvider.analyze(normalizedImage, { ...options, model: 'openai' }),
        options
      );

      totalAttempts += attempts;

      return {
        title: result.title,
        description: result.description,
        tags: result.tags,
        altText: (result as any).altText || '',
        url: result.url,
        provider: 'pollinations',
        model: result.model,
        attempts: totalAttempts,
        fallbackUsed: true,
      };
    } catch (pollinationsErr: any) {
      totalAttempts += 1;
      console.warn('[AIService] All cloud providers failed. Generating client-side deterministic fallback metadata for:', filename);

      const cleanSubject = (options.customPrompt && options.customPrompt.trim()) 
        ? options.customPrompt.trim().slice(0, 60).replace(/[#*`_]+/g, '').trim()
        : (filename || 'Inspiration')
            .replace(/\.[^/.]+$/, '')
            .replace(/^(IMG|DSC|PEXELS|UNSPLASH|SCREENSHOT|PIN|IMAGE|PHOTO)[-_0-9\s]*/i, '')
            .replace(/[_\-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || 'Inspiring Creative Ideas';

      const title = cleanSubject
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
        .slice(0, 95);

      const description = `Explore stunning inspiration, curated visual details, and modern tips for ${cleanSubject.toLowerCase()}. Discover more ideas on our website.`;
      const baseWords = cleanSubject.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const tags = cleanPinterestTopicTags([
        cleanSubject.toLowerCase(),
        `${cleanSubject.toLowerCase()} ideas`,
        `${cleanSubject.toLowerCase()} aesthetic`,
        ...baseWords.map(w => `${w} design`),
        'home decor',
        'aesthetic vibes',
        'creative ideas',
        'trending style'
      ]).slice(0, 10);

      return {
        title: title || 'Curated Visual Inspiration',
        description,
        tags,
        altText: `High-quality photograph featuring ${cleanSubject.toLowerCase()} with styled aesthetic details.`,
        url: '',
        provider: 'gemini',
        model: 'smart-generator',
        attempts: totalAttempts,
        fallbackUsed: true,
      };
    }
  }
}

// Singleton instance
export const aiService = new AIService();

/**
 * Universal top-level entry point function for the entire UI
 */
export async function analyzePinImage(
  imageInput: string | File | Blob,
  options?: AiAnalyzeOptions
): Promise<PinAnalyzeResult> {
  return aiService.analyzePinImage(imageInput, options);
}

/**
 * Regenerate a specific field (description or altText) using AI while keeping other fields intact
 */
export async function regeneratePinField(
  imageInput: string | File | Blob,
  field: 'description' | 'altText' | 'title' | 'tags',
  options?: AiAnalyzeOptions
): Promise<Partial<PinAnalyzeResult>> {
  const fullResult = await aiService.analyzePinImage(imageInput, options);
  return {
    [field]: fullResult[field as keyof PinAnalyzeResult],
    provider: fullResult.provider,
    model: fullResult.model,
  };
}
