import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const VERIFIED_GEMINI_KEY = 'AQ.Ab8RN6ITew34KNY0LVLxFvSR8xQjWXEuWXhCMaIt8LKqiBQBmA';
const CUSTOM_AI_API_URL = process.env.CUSTOM_AI_API_URL || '';
const CUSTOM_AI_API_KEY = process.env.CUSTOM_AI_API_KEY || '';
const CUSTOM_AI_MODEL = process.env.CUSTOM_AI_MODEL || '';

function getAvailableGeminiKeys(): Array<{ key: string; isBackup: boolean; label: string }> {
  const keys: Array<{ key: string; isBackup: boolean; label: string }> = [];
  const seen = new Set<string>();

  const primaryKey = (process.env.GEMINI_API_KEY || '').trim();
  if (primaryKey && !primaryKey.startsWith('MY_')) {
    seen.add(primaryKey);
    keys.push({ key: primaryKey, isBackup: false, label: 'Primary GEMINI_API_KEY' });
  }

  const backupEnvKey = (process.env.GEMINI_BACKUP_API_KEY || '').trim();
  if (backupEnvKey && !backupEnvKey.startsWith('MY_') && !seen.has(backupEnvKey)) {
    seen.add(backupEnvKey);
    keys.push({ key: backupEnvKey, isBackup: true, label: 'Configured GEMINI_BACKUP_API_KEY' });
  }

  // Include user-provided verified key from CSV
  if (VERIFIED_GEMINI_KEY && !seen.has(VERIFIED_GEMINI_KEY)) {
    seen.add(VERIFIED_GEMINI_KEY);
    keys.push({ key: VERIFIED_GEMINI_KEY, isBackup: true, label: 'Verified GEMINI_API_KEY' });
  }

  return keys;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Set up public uploads directory & in-memory cache for instant public hosting
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
const pdfUploadsDir = path.join(process.cwd(), 'public', 'uploads', 'pdfs');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(pdfUploadsDir)) {
    fs.mkdirSync(pdfUploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('[Storage] Could not create uploads directory:', err);
}

// In-memory fallback maps for high-availability media & PDF delivery across instances
const memoryImageStore = new Map<string, { buffer: Buffer; mimeType: string }>();
const memoryPdfStore = new Map<string, { buffer: Buffer; mimeType: string; uploadedAt: string }>();

// Helper to get public HTTPS base URL
function getPublicHttpsBaseUrl(req: express.Request): string {
  const clientOrigin = (req.body && req.body.clientOrigin) || (req.headers['x-client-origin'] as string);
  if (clientOrigin && (clientOrigin.startsWith('https://') || clientOrigin.startsWith('http://'))) {
    return clientOrigin.replace(/\/+$/, '').replace(/^http:\/\/([a-zA-Z0-9-]+\.run\.app)/, 'https://$1');
  }

  if (process.env.APP_URL && process.env.APP_URL.startsWith('http')) {
    return process.env.APP_URL.replace(/\/+$/, '').replace(/^http:\/\/([a-zA-Z0-9-]+\.run\.app)/, 'https://$1');
  }

  const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const proto = forwardedProto.split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
  
  const isCloudOrDomain = host.includes('run.app') || !host.includes('localhost');
  const finalProto = isCloudOrDomain ? 'https' : proto;
  return `${finalProto}://${host}`;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Tag sanitizer for Pinterest Tagged Topics (No hashtags, no hyphens, natural 1-4 word phrases)
function cleanPinterestTopics(rawTags: any): string[] {
  if (!rawTags) return [];
  const list: string[] = Array.isArray(rawTags) 
    ? rawTags 
    : typeof rawTags === 'string' 
    ? rawTags.split(/[,;\n]+/) 
    : [];

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of list) {
    if (!item || typeof item !== 'string') continue;
    const clean = item
      .replace(/[#"'`\[\]{}()\\\/,;:*~_]+/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (clean && clean.length >= 2 && !seen.has(clean)) {
      seen.add(clean);
      cleaned.push(clean);
    }
  }

  return cleaned.slice(0, 15);
}

// Natural CTA pool for rotated, traffic-focused Pinterest descriptions
const CTA_POOL = [
  "Discover more ideas on our website.",
  "Explore the full collection on our website.",
  "Visit the website for more inspiration.",
  "See the complete guide and more ideas on our website.",
  "Explore the full article for more ideas and inspiration.",
  "See more ideas and details on our website.",
  "Explore the complete guide on our website.",
  "Visit our website for more inspiration.",
  "Discover the full guide and tips on our website.",
  "Find more inspiration and details on our website."
];

function getRandomCta(): string {
  const index = Math.floor(Math.random() * CTA_POOL.length);
  return CTA_POOL[index];
}

// Check if description already contains a natural call to action
function hasCallToAction(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('website') ||
    lower.includes('visit') ||
    lower.includes('explore') ||
    lower.includes('discover') ||
    lower.includes('click') ||
    lower.includes('guide') ||
    lower.includes('collection') ||
    lower.includes('article') ||
    lower.includes('read more') ||
    lower.includes('check out')
  );
}

// Clean and validate description to ensure it complies with Pinterest best practices
function validateAndRefineDescription(rawDesc: string, fallbackSubject?: string): string {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return `Discover stylish inspiration and tips${fallbackSubject ? ` for ${fallbackSubject}` : ''}. ${getRandomCta()}`;
  }

  // Remove any hashtags (#tag)
  let clean = rawDesc.replace(/#\w+/g, '').replace(/#/g, '');

  // Remove fake full URLs from description body (e.g. http://example.com/...)
  clean = clean.replace(/https?:\/\/[^\s]+/gi, '');

  // Remove excessive whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  // If description does not contain a natural CTA, append a rotated one
  if (!hasCallToAction(clean)) {
    if (!clean.endsWith('.') && !clean.endsWith('!') && !clean.endsWith('?')) {
      clean += '.';
    }
    clean += ` ${getRandomCta()}`;
  }

  // Cap at 500 characters
  if (clean.length > 500) {
    clean = clean.slice(0, 497) + '...';
  }

  return clean;
}

// Clean and validate Alt Text (strictly visual description, NO CTAs, NO sales language)
function validateAndRefineAltText(rawAlt: string, fallbackTitle?: string): string {
  if (!rawAlt || typeof rawAlt !== 'string') {
    return fallbackTitle ? `Photograph showing ${fallbackTitle.toLowerCase()}` : 'Detailed photograph of visual subject';
  }

  let clean = rawAlt.replace(/#\w+/g, '').replace(/#/g, '').replace(/https?:\/\/[^\s]+/gi, '');

  // Strip accidental CTAs or promotional phrases from alt text
  const ctaPhrasesToRemove = [
    /click here/gi,
    /visit (our|the)? website/gi,
    /discover more (ideas|inspiration|on our website)?/gi,
    /explore the (full)? collection/gi,
    /see the complete guide/gi,
    /buy now/gi,
    /shop now/gi,
    /link in bio/gi
  ];

  for (const pattern of ctaPhrasesToRemove) {
    clean = clean.replace(pattern, '');
  }

  clean = clean.replace(/\s+/g, ' ').trim();

  // Ensure clean starts naturally without "Image of image of"
  clean = clean.replace(/^(image of|picture of|photo of|an image showing)\s+/i, '');
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  if (clean.length > 500) {
    clean = clean.slice(0, 497) + '...';
  }

  return clean || (fallbackTitle ? `Visual showing ${fallbackTitle}` : 'High quality visual photograph');
}

// Timeout helper promise
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}

// Deterministic fallback pin metadata generator (ensures zero downtime if cloud AI has temporary outages)
function generateDeterministicPinMetadata(params: {
  filename?: string;
  language?: string;
  customPrompt?: string;
  context?: { title?: string; destinationUrl?: string; tags?: string[] };
}): { title: string; description: string; tags: string[]; altText: string; url: string } {
  const { filename = '', customPrompt = '', context = {} } = params;

  let baseSubject = '';
  if (customPrompt && customPrompt.trim()) {
    baseSubject = customPrompt.trim().slice(0, 60).replace(/[#*`_]+/g, '').trim();
  } else if (context.title && context.title.trim()) {
    baseSubject = context.title.trim();
  } else if (filename) {
    const clean = filename
      .replace(/\.[^/.]+$/, '')
      .replace(/^(IMG|DSC|PEXELS|UNSPLASH|SCREENSHOT|PIN|IMAGE|PHOTO)[-_0-9\s]*/i, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    baseSubject = clean || 'Inspiring Design & Ideas';
  } else {
    baseSubject = 'Inspiring Creative Ideas';
  }

  const capitalizedTitle = baseSubject
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const title = (capitalizedTitle.length > 5 ? capitalizedTitle : `${capitalizedTitle} Inspiration`).slice(0, 95);

  const cta = getRandomCta();
  const description = validateAndRefineDescription(
    `Explore stunning inspiration, curated visual details, and modern tips for ${baseSubject.toLowerCase()}. ${cta}`,
    baseSubject
  );

  const baseWords = baseSubject.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const rawTags = [
    baseSubject.toLowerCase(),
    `${baseSubject.toLowerCase()} ideas`,
    `${baseSubject.toLowerCase()} inspiration`,
    `${baseSubject.toLowerCase()} aesthetic`,
    ...baseWords.map(w => `${w} design`),
    ...baseWords.map(w => `${w} style`),
    'home decor',
    'aesthetic vibes',
    'creative ideas',
    'visual inspiration',
    'trending style',
  ];
  const tags = cleanPinterestTopics(rawTags).slice(0, 10);

  const altText = validateAndRefineAltText(
    `High-quality photograph featuring ${baseSubject.toLowerCase()} with styled aesthetic details and balanced composition.`,
    title
  );

  return {
    title,
    description,
    tags,
    altText,
    url: context.destinationUrl || '',
  };
}

// Single Call: Gemini Vision Analysis (with Multi-Key Failover and Model Cascading)
async function runGeminiVisionAnalysis(params: {
  cleanedBase64: string;
  detectedMime: string;
  filename: string;
  language: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  timeoutMs: number;
  fieldToGenerate?: 'all' | 'description' | 'altText' | 'title' | 'tags';
  context?: { title?: string; destinationUrl?: string; tags?: string[] };
}): Promise<{ title: string; description: string; tags: string[]; altText: string; url: string; model: string; usedBackupKey?: boolean }> {
  const availableKeys = getAvailableGeminiKeys();
  if (availableKeys.length === 0) {
    throw new Error('No valid Gemini API key is configured on server (GEMINI_API_KEY or GEMINI_BACKUP_API_KEY)');
  }

  const requestedModel = params.model && params.model.startsWith('gemini-') && !params.model.includes('3.7') && !params.model.includes('2.5')
    ? params.model 
    : 'gemini-3.5-flash-lite';

  // Cascading candidate models:
  // If a model experiences high demand (503) or unavailability, cascade automatically to active models.
  const candidateModels = Array.from(new Set([
    requestedModel,
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ].filter(Boolean)));

  let lastError: any = null;

  for (let keyIdx = 0; keyIdx < availableKeys.length; keyIdx++) {
    const keyConfig = availableKeys[keyIdx];
    const ai = new GoogleGenAI({
      apiKey: keyConfig.key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    console.log(`[Gemini Engine] Using ${keyConfig.label} (key #${keyIdx + 1}/${availableKeys.length}) for "${params.filename}"`);

    for (const modelName of candidateModels) {
      try {
        console.log(`[Gemini Engine] Querying model "${modelName}" for "${params.filename}" (timeout: ${params.timeoutMs}ms)`);
        
        const genPromise = ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: params.detectedMime,
                  data: params.cleanedBase64,
                },
              },
              {
                text: params.prompt,
              },
            ],
          },
          config: {
            systemInstruction: params.systemInstruction,
            temperature: 0.7,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Searchable, attractive Pinterest title matching the image (max 100 chars).',
                },
                description: {
                  type: Type.STRING,
                  description: 'Traffic-focused Pinterest description: Hook + Value/Discovery + Natural SEO keywords + Natural CTA inviting the user to visit the website (2-4 sentences, max 500 chars).',
                },
                tags: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description: 'Exactly 10 Pinterest Tagged Topics (natural short phrases 1-4 words each, lowercase, no #, no hyphens).',
                },
                altText: {
                  type: Type.STRING,
                  description: 'Accurate, objective visual accessibility Alt Text describing visual objects, layout, colors, and scene without marketing CTAs (1-2 sentences).',
                },
                url: {
                  type: Type.STRING,
                  description: 'Suggested relevant destination web slug or URL path.',
                },
              },
              required: ['title', 'description', 'tags', 'altText'],
            },
          },
        });

        const response = await withTimeout(
          genPromise,
          params.timeoutMs,
          `Gemini API request timed out after ${params.timeoutMs}ms`
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
              throw new Error('Failed to parse Gemini JSON output');
            }
          }

          const rawTitle = (parsed.title || '').trim();
          const refinedDescription = validateAndRefineDescription(parsed.description || '', rawTitle);
          const refinedAltText = validateAndRefineAltText(parsed.altText || '', rawTitle);

          return {
            title: rawTitle,
            description: refinedDescription,
            tags: cleanPinterestTopics(parsed.tags),
            altText: refinedAltText,
            url: (parsed.url || '').trim(),
            model: modelName,
            usedBackupKey: keyConfig.isBackup,
          };
        }
      } catch (err: any) {
        lastError = err;
        const statusCode = err?.status || err?.statusCode || 500;
        const errMsg = String(err?.message || '').toLowerCase();
        const isQuotaOrRateLimit = statusCode === 429 || 
          errMsg.includes('quota') ||
          errMsg.includes('resource_exhausted') ||
          errMsg.includes('rate limit');
        const isAuthError = statusCode === 401 || statusCode === 403 || errMsg.includes('permission_denied') || errMsg.includes('denied access');

        console.warn(`[Gemini Engine] ${keyConfig.label} failed with model "${modelName}" (HTTP ${statusCode}):`, err.message);

        // If auth error or quota exhausted, fail over to the next configured key immediately
        if (isAuthError || isQuotaOrRateLimit) {
          if (keyIdx < availableKeys.length - 1) {
            console.warn(`[Gemini Engine] Detected auth/quota failure on ${keyConfig.label}. Seamlessly failing over to next available Gemini key...`);
          }
          break;
        }

        // For 503 (high demand) or 404, continue to next model in candidateModels
        console.warn(`[Gemini Engine] Model "${modelName}" returned ${statusCode}. Testing next candidate model in cascade...`);
      }
    }
  }

  throw lastError || new Error('Gemini Vision analysis failed across all configured API keys and models');
}

// Single Call: Pollinations AI Vision Analysis (with Text-Context Fallback)
async function runPollinationsVisionAnalysis(params: {
  fullDataUri: string;
  filename: string;
  language: string;
  model: string;
  systemInstruction: string;
  prompt: string;
  timeoutMs: number;
  fieldToGenerate?: 'all' | 'description' | 'altText' | 'title' | 'tags';
}): Promise<{ title: string; description: string; tags: string[]; altText: string; url: string; model: string }> {
  const rawKey = (POLLINATIONS_API_KEY || '').trim();
  const pollinationsKey = rawKey && !rawKey.startsWith('MY_') ? rawKey : '';
  const targetModel = params.model && !params.model.startsWith('gemini-') 
    ? params.model 
    : 'openai';

  let lastError: any = null;

  // Approach 1: Try gen.pollinations.ai multimodal vision if a valid key is provided
  if (pollinationsKey) {
    try {
      console.log(`[Pollinations Engine] Requesting gen.pollinations.ai with model "${targetModel}" for "${params.filename}"`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);

      const polliRes = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pollinationsKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: params.systemInstruction },
            {
              role: 'user',
              content: [
                { type: 'text', text: params.prompt },
                { type: 'image_url', image_url: { url: params.fullDataUri } },
              ],
            },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      });

      clearTimeout(timeoutId);

      if (polliRes.ok) {
        const resJson: any = await polliRes.json();
        const rawContent = resJson?.choices?.[0]?.message?.content || '';
        const match = rawContent.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const rawTitle = (parsed.title || '').trim();
          return {
            title: rawTitle,
            description: validateAndRefineDescription(parsed.description || '', rawTitle),
            tags: cleanPinterestTopics(parsed.tags),
            altText: validateAndRefineAltText(parsed.altText || '', rawTitle),
            url: (parsed.url || '').trim(),
            model: targetModel,
          };
        }
      } else {
        const errBody = await polliRes.text().catch(() => '');
        console.warn(`[Pollinations Engine] gen.pollinations.ai returned ${polliRes.status}: ${errBody.slice(0, 100)}`);
      }
    } catch (err: any) {
      lastError = err;
      console.warn('[Pollinations Engine] gen.pollinations.ai request failed:', err.message);
    }
  }

  // Approach 2: Robust text-based Pinterest metadata generation on text.pollinations.ai
  // Highly reliable fallback without requiring vision tokens, built on filename & context
  try {
    console.log(`[Pollinations Engine] Requesting text.pollinations.ai for "${params.filename}"`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (pollinationsKey) {
      headers['Authorization'] = `Bearer ${pollinationsKey}`;
    }

    const textPrompt = `${params.prompt}\nContext: Image filename is "${params.filename || 'pinterest-pin.jpg'}". Generate complete title, traffic-focused description with website CTA, 10 Pinterest tags, and objective alt text.`;

    const polliRes = await fetch('https://text.pollinations.ai/openai/chat/completions', {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: params.systemInstruction },
          { role: 'user', content: textPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    clearTimeout(timeoutId);

    if (polliRes.ok) {
      const resJson: any = await polliRes.json();
      const rawContent = resJson?.choices?.[0]?.message?.content || '';
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const rawTitle = (parsed.title || '').trim();
        return {
          title: rawTitle,
          description: validateAndRefineDescription(parsed.description || '', rawTitle),
          tags: cleanPinterestTopics(parsed.tags),
          altText: validateAndRefineAltText(parsed.altText || '', rawTitle),
          url: (parsed.url || '').trim(),
          model: 'pollinations-text-openai',
        };
      }
    } else {
      const errBody = await polliRes.text().catch(() => '');
      throw new Error(`Pollinations HTTP ${polliRes.status}: ${errBody.slice(0, 150)}`);
    }
  } catch (err: any) {
    lastError = err;
    console.warn('[Pollinations Engine] text.pollinations.ai failed:', err.message);
  }

  throw lastError || new Error('Pollinations AI analysis failed');
}

// Groq AI Provider Runner (Ultra-fast Pinterest Content Generation)
async function runGroqVisionAnalysis(params: {
  apiKey?: string;
  model?: string;
  fullDataUri: string;
  filename: string;
  language: string;
  systemInstruction: string;
  prompt: string;
  timeoutMs: number;
}): Promise<{ title: string; description: string; tags: string[]; altText: string; url: string; model: string }> {
  const token = (params.apiKey || GROQ_API_KEY || '').trim();
  if (!token) throw new Error('Groq API Key is not configured');

  const targetModel = params.model || 'openai/gpt-oss-120b';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const textPrompt = `${params.prompt}\nContext: Image filename is "${params.filename || 'pinterest-pin.jpg'}". Generate attractive Pinterest title, description with natural website CTA, 10 Pinterest topic tags, and objective alt text.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: params.systemInstruction },
          { role: 'user', content: textPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data: any = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content || '';
    const match = String(rawContent).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Groq did not return valid JSON');

    const parsed = JSON.parse(match[0]);
    const rawTitle = (parsed.title || '').trim();

    return {
      title: rawTitle,
      description: validateAndRefineDescription(parsed.description || '', rawTitle),
      tags: cleanPinterestTopics(parsed.tags),
      altText: validateAndRefineAltText(parsed.altText || '', rawTitle),
      url: (parsed.url || '').trim(),
      model: targetModel,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// OpenRouter AI Provider Runner (Multi-Model Gateway with Vision Support)
async function runOpenRouterVisionAnalysis(params: {
  apiKey?: string;
  model?: string;
  fullDataUri: string;
  filename: string;
  language: string;
  systemInstruction: string;
  prompt: string;
  timeoutMs: number;
}): Promise<{ title: string; description: string; tags: string[]; altText: string; url: string; model: string }> {
  const token = (params.apiKey || OPENROUTER_API_KEY || '').trim();
  if (!token) throw new Error('OpenRouter API Key is not configured');

  const targetModel = params.model || 'openrouter/auto';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'HTTP-Referer': 'https://pinpulse.app',
    'X-Title': 'PinPulse Pinterest Publisher',
  };

  try {
    // Attempt 1: Try with multimodal image_url
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: params.systemInstruction },
            {
              role: 'user',
              content: [
                { type: 'text', text: params.prompt },
                { type: 'image_url', image_url: { url: params.fullDataUri } },
              ],
            },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const data: any = await res.json();
        const rawContent = data?.choices?.[0]?.message?.content || '';
        const match = String(rawContent).match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const rawTitle = (parsed.title || '').trim();
          return {
            title: rawTitle,
            description: validateAndRefineDescription(parsed.description || '', rawTitle),
            tags: cleanPinterestTopics(parsed.tags),
            altText: validateAndRefineAltText(parsed.altText || '', rawTitle),
            url: (parsed.url || '').trim(),
            model: data.model || targetModel,
          };
        }
      }
    } catch {
      // Fall through to text prompt
    }

    // Attempt 2: Text-based Pinterest prompt with filename and context
    const textPrompt = `${params.prompt}\nContext: Image filename is "${params.filename || 'pinterest-pin.jpg'}". Generate Pinterest title, description with natural website CTA, 10 Pinterest topic tags, and objective alt text.`;

    const textRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: params.systemInstruction },
          { role: 'user', content: textPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    clearTimeout(timeoutId);

    if (!textRes.ok) {
      const errText = await textRes.text().catch(() => '');
      throw new Error(`OpenRouter HTTP ${textRes.status}: ${errText.slice(0, 150)}`);
    }

    const data: any = await textRes.json();
    const rawContent = data?.choices?.[0]?.message?.content || '';
    const match = String(rawContent).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('OpenRouter did not return valid JSON');

    const parsed = JSON.parse(match[0]);
    const rawTitle = (parsed.title || '').trim();

    return {
      title: rawTitle,
      description: validateAndRefineDescription(parsed.description || '', rawTitle),
      tags: cleanPinterestTopics(parsed.tags),
      altText: validateAndRefineAltText(parsed.altText || '', rawTitle),
      url: (parsed.url || '').trim(),
      model: data.model || targetModel,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Custom API Provider Call (allows replacing Gemini with any custom or external AI API endpoint)
async function runCustomApiVisionAnalysis(params: {
  endpointUrl: string;
  apiKey?: string;
  model?: string;
  fullDataUri: string;
  filename: string;
  language: string;
  systemInstruction: string;
  prompt: string;
  timeoutMs: number;
}): Promise<{ title: string; description: string; tags: string[]; altText: string; url: string; model: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs);
  const targetModel = params.model || CUSTOM_AI_MODEL || 'gpt-4o';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = params.apiKey || CUSTOM_AI_API_KEY;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(params.endpointUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: params.systemInstruction },
          {
            role: 'user',
            content: [
              { type: 'text', text: params.prompt },
              { type: 'image_url', image_url: { url: params.fullDataUri } },
            ],
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 400 || errBody.toLowerCase().includes('image')) {
        const textRes = await fetch(params.endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: targetModel,
            messages: [
              { role: 'system', content: params.systemInstruction },
              { role: 'user', content: `${params.prompt}\nFilename: "${params.filename}"` },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        });
        if (textRes.ok) {
          const textJson: any = await textRes.json();
          const content = textJson?.choices?.[0]?.message?.content || textJson?.content || '';
          const match = String(content).match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const rawTitle = (parsed.title || '').trim();
            return {
              title: rawTitle,
              description: validateAndRefineDescription(parsed.description || '', rawTitle),
              tags: cleanPinterestTopics(parsed.tags),
              altText: validateAndRefineAltText(parsed.altText || '', rawTitle),
              url: (parsed.url || '').trim(),
              model: targetModel,
            };
          }
        }
      }
      throw new Error(`Custom AI endpoint returned HTTP ${res.status}: ${errBody.slice(0, 150)}`);
    }

    const resJson: any = await res.json();
    const rawContent = resJson?.choices?.[0]?.message?.content || resJson?.content || '';
    const match = String(rawContent).match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Custom AI did not return a valid JSON object');
    }

    const parsed = JSON.parse(match[0]);
    const rawTitle = (parsed.title || '').trim();
    return {
      title: rawTitle,
      description: validateAndRefineDescription(parsed.description || '', rawTitle),
      tags: cleanPinterestTopics(parsed.tags),
      altText: validateAndRefineAltText(parsed.altText || '', rawTitle),
      url: (parsed.url || '').trim(),
      model: targetModel,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Unified AI Metadata Generation Endpoint (Auto Fallback + Retries + Timeout)
async function handlePinAnalysis(req: express.Request, res: express.Response) {
  try {
    const { 
      imageBase64, 
      mimeType = 'image/jpeg', 
      filename = '', 
      language = 'English',
      provider = 'groq', // 'groq' | 'openrouter' | 'auto' | 'gemini' | 'pollinations' | 'custom'
      groqApiKey = '',
      groqModel = '',
      openrouterApiKey = '',
      openrouterModel = '',
      customApiUrl = '',
      customApiKey = '',
      customApiModel = '',
      model = 'openai/gpt-oss-120b',
      autoRetry = true,
      maxRetries = 3,
      retryDelay = 2000,
      timeout = 20000,
      fieldToGenerate = 'all',
      context = {},
      customPrompt = '',
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    // Clean base64 string if data URL prefix exists
    let cleanedBase64 = imageBase64;
    let detectedMime = mimeType;
    if (imageBase64.includes('base64,')) {
      const parts = imageBase64.split('base64,');
      cleanedBase64 = parts[1];
      const mimeMatch = parts[0].match(/data:(.*?);/);
      if (mimeMatch) {
        detectedMime = mimeMatch[1];
      }
    }

    const fullDataUri = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:${detectedMime};base64,${cleanedBase64}`;

    const customInstructionsBlock = customPrompt && typeof customPrompt === 'string' && customPrompt.trim()
      ? `

USER-SPECIFIED FOCUS & CONTENT GUIDELINES:
"""
${customPrompt.trim()}
"""
CRITICAL DIRECTIVE: The user has provided the specific direction, topic, keywords, or creative angle above. You MUST build the Pin TITLE and DESCRIPTION upon these user-specified instructions and ideas, blending them seamlessly with what is visibly depicted in the image. Ensure the generated title and description emphasize this requested focus.`
      : '';

    const systemInstruction = `You are an expert Pinterest content strategist, visual SEO taxonomy specialist, and copywriter.
Analyze this Pinterest image carefully. Identify only what is actually visible in the image.
Determine the main subject, visual theme, audience, context, style, colors, and Pinterest category taxonomy.${customInstructionsBlock}

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
  "altText": "string",
  "url": "string"
}`;

    const customPromptNote = customPrompt && typeof customPrompt === 'string' && customPrompt.trim()
      ? ` Incorporate and build upon this user guidance/topic: "${customPrompt.trim()}".`
      : '';
    const prompt = `Analyze this Pinterest image (original filename: "${filename || 'pin-image'}")${customPromptNote} and generate traffic-focused title, description with natural website CTA, 8-15 Pinterest keyword tags, and objective visual altText in ${language}. Return JSON only.`;

    const effectiveMaxRetries = autoRetry ? Math.max(1, Math.min(Number(maxRetries) || 3, 5)) : 1;
    const effectiveRetryDelay = Math.max(500, Math.min(Number(retryDelay) || 2000, 10000));
    const effectiveTimeout = Math.max(5000, Math.min(Number(timeout) || 20000, 60000));

    console.log(`[AI Express Router] Request for "${filename}": Provider="${provider}", AutoRetry=${autoRetry}, MaxRetries=${effectiveMaxRetries}, Timeout=${effectiveTimeout}ms`);

    let attemptsCount = 0;
    let lastError: any = null;

    // --- CASE GROQ (Ultra Fast Pinterest Generation) ---
    if (provider === 'groq') {
      const effectiveGroqKey = (groqApiKey || GROQ_API_KEY || '').trim();
      const targetGroqModel = groqModel || 'openai/gpt-oss-120b';

      for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
        attemptsCount++;
        try {
          console.log(`[AI Express Router] Groq attempt ${attempt}/${effectiveMaxRetries} (model: ${targetGroqModel})`);
          const result = await runGroqVisionAnalysis({
            apiKey: effectiveGroqKey,
            model: targetGroqModel,
            fullDataUri,
            filename,
            language,
            systemInstruction,
            prompt,
            timeoutMs: effectiveTimeout,
          });

          return res.status(200).json({
            title: result.title,
            description: result.description,
            tags: result.tags,
            altText: result.altText,
            url: result.url,
            provider: 'groq',
            model: result.model,
            attempts: attemptsCount,
            fallbackUsed: false,
          });
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Express Router] Groq attempt ${attempt} failed:`, err.message);
          if (attempt < effectiveMaxRetries) {
            await wait(effectiveRetryDelay);
          }
        }
      }

      return res.status(500).json({
        error: `Groq AI failed after ${attemptsCount} attempts: ${lastError?.message || 'Unknown error'}`,
        provider: 'groq',
        attempts: attemptsCount,
      });
    }

    // --- CASE OPENROUTER (Multi-model Gateway) ---
    if (provider === 'openrouter') {
      const effectiveOpenRouterKey = (openrouterApiKey || OPENROUTER_API_KEY || '').trim();
      const targetOpenRouterModel = openrouterModel || 'openrouter/auto';

      for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
        attemptsCount++;
        try {
          console.log(`[AI Express Router] OpenRouter attempt ${attempt}/${effectiveMaxRetries} (model: ${targetOpenRouterModel})`);
          const result = await runOpenRouterVisionAnalysis({
            apiKey: effectiveOpenRouterKey,
            model: targetOpenRouterModel,
            fullDataUri,
            filename,
            language,
            systemInstruction,
            prompt,
            timeoutMs: effectiveTimeout,
          });

          return res.status(200).json({
            title: result.title,
            description: result.description,
            tags: result.tags,
            altText: result.altText,
            url: result.url,
            provider: 'openrouter',
            model: result.model,
            attempts: attemptsCount,
            fallbackUsed: false,
          });
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Express Router] OpenRouter attempt ${attempt} failed:`, err.message);
          if (attempt < effectiveMaxRetries) {
            await wait(effectiveRetryDelay);
          }
        }
      }

      return res.status(500).json({
        error: `OpenRouter failed after ${attemptsCount} attempts: ${lastError?.message || 'Unknown error'}`,
        provider: 'openrouter',
        attempts: attemptsCount,
      });
    }

    // --- CASE 0: Custom AI API Endpoint (Explicit or via environment) ---
    const effectiveCustomUrl = (customApiUrl || CUSTOM_AI_API_URL || '').trim();
    if (provider === 'custom' || (effectiveCustomUrl && provider === 'auto')) {
      for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
        attemptsCount++;
        try {
          console.log(`[AI Express Router] Custom AI API attempt ${attempt}/${effectiveMaxRetries} to ${effectiveCustomUrl}`);
          const result = await runCustomApiVisionAnalysis({
            endpointUrl: effectiveCustomUrl,
            apiKey: customApiKey || CUSTOM_AI_API_KEY,
            model: customApiModel || CUSTOM_AI_MODEL,
            fullDataUri,
            filename,
            language,
            systemInstruction,
            prompt,
            timeoutMs: effectiveTimeout,
          });

          return res.status(200).json({
            title: result.title,
            description: result.description,
            tags: result.tags,
            altText: result.altText,
            url: result.url,
            provider: 'custom',
            model: result.model,
            attempts: attemptsCount,
            fallbackUsed: false,
          });
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Express Router] Custom AI API attempt ${attempt} failed:`, err.message);
          if (attempt < effectiveMaxRetries) {
            await wait(effectiveRetryDelay);
          }
        }
      }

      if (provider === 'custom') {
        return res.status(500).json({
          error: `Custom AI API failed after ${attemptsCount} attempts: ${lastError?.message || 'Unknown error'}`,
          provider: 'custom',
          attempts: attemptsCount,
        });
      }
    }

    // --- CASE 1: Pollinations Only ---
    if (provider === 'pollinations') {
      for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
        attemptsCount++;
        try {
          console.log(`[AI Express Router] Pollinations attempt ${attempt}/${effectiveMaxRetries}`);
          const result = await runPollinationsVisionAnalysis({
            fullDataUri,
            filename,
            language,
            model,
            systemInstruction,
            prompt,
            timeoutMs: effectiveTimeout,
            fieldToGenerate,
          });

          return res.status(200).json({
            title: result.title,
            description: result.description,
            tags: result.tags,
            altText: result.altText,
            url: result.url,
            provider: 'pollinations',
            model: result.model,
            attempts: attemptsCount,
            fallbackUsed: false,
          });
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Express Router] Pollinations attempt ${attempt} failed:`, err.message);
          if (attempt < effectiveMaxRetries) {
            await wait(effectiveRetryDelay);
          }
        }
      }

      return res.status(500).json({
        error: `Pollinations AI failed after ${attemptsCount} attempts: ${lastError?.message || 'Unknown error'}`,
        provider: 'pollinations',
        attempts: attemptsCount,
      });
    }

    // --- CASE 2: Gemini Only ---
    if (provider === 'gemini') {
      const availableGeminiKeys = getAvailableGeminiKeys();
      if (availableGeminiKeys.length === 0) {
        return res.status(500).json({ 
          error: 'Gemini API key is not configured on server (GEMINI_API_KEY or GEMINI_BACKUP_API_KEY)',
          provider: 'gemini',
        });
      }

      for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
        attemptsCount++;
        try {
          console.log(`[AI Express Router] Gemini attempt ${attempt}/${effectiveMaxRetries}`);
          const result = await runGeminiVisionAnalysis({
            cleanedBase64,
            detectedMime,
            filename,
            language,
            model,
            systemInstruction,
            prompt,
            timeoutMs: effectiveTimeout,
            fieldToGenerate,
            context,
          });

          return res.status(200).json({
            title: result.title,
            description: result.description,
            tags: result.tags,
            altText: result.altText,
            url: result.url,
            provider: 'gemini',
            model: result.model,
            attempts: attemptsCount,
            fallbackUsed: Boolean(result.usedBackupKey),
            usedBackupKey: Boolean(result.usedBackupKey),
          });
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Express Router] Gemini attempt ${attempt} failed:`, err.message);
          if (attempt < effectiveMaxRetries) {
            await wait(effectiveRetryDelay);
          }
        }
      }

      return res.status(500).json({
        error: `Gemini AI failed after ${attemptsCount} attempts: ${lastError?.message || 'Unknown error'}`,
        provider: 'gemini',
        attempts: attemptsCount,
      });
    }

    // --- CASE 3: AUTO MODE (Groq -> OpenRouter -> Gemini -> Pollinations) ---
    // Step 3A: Try Groq first (Ultra Fast)
    const autoGroqKey = (groqApiKey || GROQ_API_KEY || '').trim();
    if (autoGroqKey) {
      try {
        console.log(`[AI Express Router: Auto] Trying Groq primary...`);
        const result = await runGroqVisionAnalysis({
          apiKey: autoGroqKey,
          model: groqModel || 'openai/gpt-oss-120b',
          fullDataUri,
          filename,
          language,
          systemInstruction,
          prompt,
          timeoutMs: effectiveTimeout,
        });

        return res.status(200).json({
          title: result.title,
          description: result.description,
          tags: result.tags,
          altText: result.altText,
          url: result.url,
          provider: 'groq',
          model: result.model,
          attempts: 1,
          fallbackUsed: false,
        });
      } catch (err: any) {
        console.warn('[AI Express Router: Auto] Groq failed, cascading to OpenRouter / Gemini...', err.message);
      }
    }

    // Step 3B: Try OpenRouter
    const autoOpenRouterKey = (openrouterApiKey || OPENROUTER_API_KEY || '').trim();
    if (autoOpenRouterKey) {
      try {
        console.log(`[AI Express Router: Auto] Trying OpenRouter...`);
        const result = await runOpenRouterVisionAnalysis({
          apiKey: autoOpenRouterKey,
          model: openrouterModel || 'openrouter/auto',
          fullDataUri,
          filename,
          language,
          systemInstruction,
          prompt,
          timeoutMs: effectiveTimeout,
        });

        return res.status(200).json({
          title: result.title,
          description: result.description,
          tags: result.tags,
          altText: result.altText,
          url: result.url,
          provider: 'openrouter',
          model: result.model,
          attempts: 1,
          fallbackUsed: true,
        });
      } catch (err: any) {
        console.warn('[AI Express Router: Auto] OpenRouter failed, cascading...', err.message);
      }
    }

    // Step 3C: Attempt Gemini if keys are available
    const availableGeminiKeys = getAvailableGeminiKeys();
    if (availableGeminiKeys.length > 0) {
      for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
        attemptsCount++;
        try {
          console.log(`[AI Express Router: Auto] Trying Gemini (attempt ${attempt}/${effectiveMaxRetries})`);
          const result = await runGeminiVisionAnalysis({
            cleanedBase64,
            detectedMime,
            filename,
            language,
            model,
            systemInstruction,
            prompt,
            timeoutMs: effectiveTimeout,
            fieldToGenerate,
            context,
          });

          return res.status(200).json({
            title: result.title,
            description: result.description,
            tags: result.tags,
            altText: result.altText,
            url: result.url,
            provider: 'gemini',
            model: result.model,
            attempts: attemptsCount,
            fallbackUsed: Boolean(result.usedBackupKey),
            usedBackupKey: Boolean(result.usedBackupKey),
          });
        } catch (err: any) {
          lastError = err;
          console.warn(`[AI Express Router: Auto] Gemini attempt ${attempt} failed:`, err.message);
          if (attempt < effectiveMaxRetries) {
            await wait(effectiveRetryDelay);
          }
        }
      }
      console.warn(`[AI Express Router: Auto] Gemini failed all ${effectiveMaxRetries} attempts across keys. Switching to Pollinations fallback...`);
    } else {
      console.log('[AI Express Router: Auto] Gemini keys not configured. Falling back to Pollinations AI...');
    }

    // Step 3B: Pollinations Fallback
    for (let fallbackAttempt = 1; fallbackAttempt <= effectiveMaxRetries; fallbackAttempt++) {
      attemptsCount++;
      try {
        console.log(`[AI Express Router: Auto Fallback] Trying Pollinations (attempt ${fallbackAttempt}/${effectiveMaxRetries})`);
        const result = await runPollinationsVisionAnalysis({
          fullDataUri,
          filename,
          language,
          model: 'openai',
          systemInstruction,
          prompt,
          timeoutMs: effectiveTimeout,
          fieldToGenerate,
        });

        return res.status(200).json({
          title: result.title,
          description: result.description,
          tags: result.tags,
          altText: result.altText,
          url: result.url,
          provider: 'pollinations',
          model: result.model,
          attempts: attemptsCount,
          fallbackUsed: true,
        });
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Express Router: Auto Fallback] Pollinations attempt ${fallbackAttempt} failed:`, err.message);
        if (fallbackAttempt < effectiveMaxRetries) {
          await wait(effectiveRetryDelay);
        }
      }
    }

    // Step 3C: Resilient Fallback Generator (ensures zero downtime if all cloud APIs are temporarily unavailable)
    console.warn(`[AI Express Router] All cloud AI providers unavailable. Generating resilient fallback Pinterest metadata for "${filename}"`);
    const fallbackData = generateDeterministicPinMetadata({
      filename,
      language,
      customPrompt,
      context,
    });

    return res.status(200).json({
      title: fallbackData.title,
      description: fallbackData.description,
      tags: fallbackData.tags,
      altText: fallbackData.altText,
      url: fallbackData.url,
      provider: 'fallback',
      model: 'smart-generator',
      attempts: attemptsCount,
      fallbackUsed: true,
      offlineFallback: true,
    });

  } catch (err: any) {
    console.error('[AI Express Router] Server error during analysis:', err);
    // Even on server exception, return clean fallback metadata rather than crashing user batch
    const { filename = '', language = 'English', customPrompt = '', context = {} } = req.body || {};
    const safeFallback = generateDeterministicPinMetadata({ filename, language, customPrompt, context });
    return res.status(200).json({
      title: safeFallback.title,
      description: safeFallback.description,
      tags: safeFallback.tags,
      altText: safeFallback.altText,
      url: safeFallback.url,
      provider: 'fallback',
      model: 'smart-generator',
      attempts: 1,
      fallbackUsed: true,
      offlineFallback: true,
    });
  }
}

// Handler for eBook / PDF Group Metadata Analysis
async function handleEbookAnalysis(req: express.Request, res: express.Response) {
  try {
    const {
      pdfNumber = '001',
      namingPrefix = '',
      filenames = [],
      existingTitles = [],
      sampleImageBase64 = '',
      language = 'English',
      provider = 'auto',
      model = 'gemini-3.5-flash-lite',
    } = req.body;

    const titlesContext = existingTitles.filter(Boolean).slice(0, 20).join(', ');
    const filenamesContext = filenames.filter(Boolean).slice(0, 20).join(', ');

    const systemInstruction = `You are a professional digital publishing strategist, SEO specialist, and eBook copywriter.
Your task is to analyze a curated group of images/pages intended for a printable PDF eBook publication.
Based on the page titles, filenames, and optional visual context, generate comprehensive, commercial-grade metadata.

Fields to generate:
1. ebookTitle: Highly marketable, clear, attractive eBook title (max 70 chars, unique, no spam).
2. subtitle: Descriptive, benefit-driven subtitle (max 100 chars).
3. shortDescription: Catchy 1-2 sentence hook highlighting the content value (max 200 chars).
4. longDescription: 2-4 sentences explaining who it's for, what's inside, and how to use it (max 500 chars).
5. mainTopic: Core niche topic/subject (e.g. "Minimalist Home Decor", "Kids Animal Coloring").
6. audience: Target demographic/readers (e.g. "Crafters, Parents, DIY Enthusiasts").
7. category: Marketplace category (e.g. "Digital Printables", "Activity Books", "Educational").
8. seoKeywords: 10 to 15 search keywords (lowercase phrases 1-3 words each).
9. pinterestKeywords: 5 to 10 Pinterest search tags (natural lowercase phrases, no #).
10. pinterestTitle: Click-worthy Pinterest title for pinning this eBook (max 100 chars).
11. pinterestDescription: Traffic-focused Pinterest description with a natural call-to-action to download/visit (max 450 chars).

Language: Output all text in ${language}.
Return strictly valid JSON.`;

    const promptText = `Analyze this eBook group (PDF #${pdfNumber}, prefix: "${namingPrefix || 'eBook'}") containing ${filenames.length} images.
Sample filenames: ${filenamesContext || 'images'}
Identified page titles: ${titlesContext || 'none'}
Generate complete commercial eBook metadata in ${language}. Return JSON only.`;

    const availableGeminiKeys = getAvailableGeminiKeys();
    let geminiSuccess = false;
    let resultData: any = null;

    const candidateEbookModels = Array.from(new Set([
      model && model.startsWith('gemini-') && !model.includes('3.7') && !model.includes('2.5') ? model : 'gemini-3.5-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ]));

    if ((provider === 'auto' || provider === 'gemini') && availableGeminiKeys.length > 0) {
      for (const keyConfig of availableGeminiKeys) {
        if (geminiSuccess) break;
        const ai = new GoogleGenAI({
          apiKey: keyConfig.key,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        for (const candidateModel of candidateEbookModels) {
          try {
            const parts: any[] = [{ text: promptText }];

            if (sampleImageBase64) {
              let cleanB64 = sampleImageBase64;
              let mime = 'image/jpeg';
              if (sampleImageBase64.includes('base64,')) {
                const sp = sampleImageBase64.split('base64,');
                cleanB64 = sp[1];
                const mm = sp[0].match(/data:(.*?);/);
                if (mm) mime = mm[1];
              }
              parts.unshift({
                inlineData: {
                  mimeType: mime,
                  data: cleanB64,
                },
              });
            }

            const genPromise = ai.models.generateContent({
              model: candidateModel,
              contents: { parts },
              config: {
                systemInstruction,
                temperature: 0.7,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    ebookTitle: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    shortDescription: { type: Type.STRING },
                    longDescription: { type: Type.STRING },
                    mainTopic: { type: Type.STRING },
                    audience: { type: Type.STRING },
                    category: { type: Type.STRING },
                    seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pinterestKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    pinterestTitle: { type: Type.STRING },
                    pinterestDescription: { type: Type.STRING },
                  },
                  required: ['ebookTitle', 'subtitle', 'shortDescription', 'longDescription', 'mainTopic', 'audience', 'category', 'seoKeywords', 'pinterestKeywords', 'pinterestTitle', 'pinterestDescription'],
                },
              },
            });

            const response = await withTimeout(genPromise, 25000, 'Gemini eBook request timeout');
            if (response && response.text) {
              resultData = JSON.parse(response.text);
              geminiSuccess = true;
              break;
            }
          } catch (err: any) {
            console.warn(`[Gemini Ebook] ${keyConfig.label} with model "${candidateModel}" error:`, err.message);
          }
        }
      }
    }

    if (!geminiSuccess) {
      // Fallback to Pollinations
      console.log('[Pollinations Ebook] Falling back to Pollinations for eBook metadata');
      const polliRes = await fetch('https://text.pollinations.ai/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: promptText },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (polliRes.ok) {
        const polliJson: any = await polliRes.json();
        const content = polliJson?.choices?.[0]?.message?.content || '';
        resultData = JSON.parse(content);
      }
    }

    if (!resultData || !resultData.ebookTitle) {
      // Deterministic graceful fallback if network is offline
      const fallbackSubject = namingPrefix ? namingPrefix.replace(/[_\-]+/g, ' ') : 'Curated Collection';
      resultData = {
        ebookTitle: `${fallbackSubject} Vol. ${pdfNumber}`,
        subtitle: `Complete ${filenames.length}-Page Digital Collection`,
        shortDescription: `A high-quality printable collection of ${filenames.length} curated pages for inspiration and creative projects.`,
        longDescription: `Explore this comprehensive digital eBook featuring ${filenames.length} hand-selected pages. Ideal for personal inspiration, printables, and creative work.`,
        mainTopic: fallbackSubject,
        audience: 'General Digital Creators & Enthusiasts',
        category: 'Digital Printables & Guides',
        seoKeywords: [fallbackSubject.toLowerCase(), 'printable pdf', 'digital ebook', 'collection', 'creative guide'],
        pinterestKeywords: [fallbackSubject.toLowerCase(), 'printable pdf', 'digital guide', 'ideas and inspiration'],
        pinterestTitle: `${fallbackSubject} Printable PDF Collection #${pdfNumber}`,
        pinterestDescription: `Download this stunning ${filenames.length}-page digital collection! Visit our website to explore the full PDF eBook and more creative ideas.`,
      };
    }

    return res.status(200).json({
      success: true,
      metadata: {
        ebookTitle: String(resultData.ebookTitle || '').trim(),
        subtitle: String(resultData.subtitle || '').trim(),
        shortDescription: String(resultData.shortDescription || '').trim(),
        longDescription: String(resultData.longDescription || '').trim(),
        mainTopic: String(resultData.mainTopic || '').trim(),
        audience: String(resultData.audience || '').trim(),
        category: String(resultData.category || '').trim(),
        seoKeywords: Array.isArray(resultData.seoKeywords) ? resultData.seoKeywords : [],
        pinterestKeywords: Array.isArray(resultData.pinterestKeywords) ? cleanPinterestTopics(resultData.pinterestKeywords) : [],
        pinterestTitle: String(resultData.pinterestTitle || resultData.ebookTitle || '').trim().slice(0, 100),
        pinterestDescription: validateAndRefineDescription(resultData.pinterestDescription || resultData.shortDescription || ''),
      },
    });
  } catch (err: any) {
    console.error('[AI Ebook Router] Error generating eBook metadata:', err);
    return res.status(500).json({
      error: err.message || 'Failed to generate eBook metadata',
    });
  }
}

// AI Endpoints
app.post('/api/ai/analyze-pin', handlePinAnalysis);
app.post('/api/gemini/analyze-pin', handlePinAnalysis);
app.post('/api/pollinations/analyze-pin', handlePinAnalysis);
app.post('/api/ai/analyze-ebook', handleEbookAnalysis);

// List Available AI Providers & Models
app.get('/api/ai/models', (req, res) => {
  res.json({
    activeProvider: 'auto',
    pollinations: {
      hasKey: Boolean(POLLINATIONS_API_KEY),
      models: [
        { id: 'openai', name: 'OpenAI GPT-4o (Vision)', description: 'High precision multimodal vision & Pinterest taxonomy', isVision: true, recommended: true },
        { id: 'gpt-4o-mini', name: 'OpenAI GPT-4o Mini (Fast)', description: 'Ultra-fast visual metadata generation', isVision: true },
        { id: 'claude', name: 'Claude 3.5 Sonnet (Vision)', description: 'Natural linguistic taxonomy & engaging descriptions', isVision: true },
        { id: 'gemini-pollinations', name: 'Gemini 2.5 (via Pollinations)', description: 'Google vision routed via Pollinations network', isVision: true },
        { id: 'qwen', name: 'Qwen 2.5 VL (Vision)', description: 'Advanced open-weight visual understanding', isVision: true },
        { id: 'mistral', name: 'Mistral Large', description: 'Multilingual vision & content classification', isVision: true },
        { id: 'deepseek', name: 'DeepSeek V3.2', description: 'Deep reasoning & structured metadata', isVision: true },
      ],
    },
    gemini: {
      hasKey: getAvailableGeminiKeys().length > 0,
      hasBackupKey: getAvailableGeminiKeys().some(k => k.isBackup),
      models: [
        { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', description: 'Ultra-fast multimodal vision & high throughput', isVision: true, recommended: true },
        { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Google GenAI native vision intelligence', isVision: true },
      ],
    },
  });
});

// Pinterest API Proxy Endpoints
const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

async function fetchPinterestWithRetry(url: string, options: any, maxRetries = 3) {
  let lastError: any = null;
  let lastResponse: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      lastResponse = res;

      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < maxRetries) {
        const backoffMs = attempt * 1500;
        console.warn(`[Pinterest API] Request returned HTTP ${res.status}. Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
        await wait(backoffMs);
        continue;
      }

      return res;
    } catch (networkErr: any) {
      lastError = networkErr;
      if (attempt < maxRetries) {
        const backoffMs = attempt * 1500;
        console.warn(`[Pinterest API] Network error: ${networkErr.message}. Retrying in ${backoffMs}ms...`);
        await wait(backoffMs);
        continue;
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Network error calling Pinterest API');
}

function resolvePinterestToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const headerToken = authHeader.substring(7).trim();
    if (headerToken) return headerToken;
  }
  const envToken = process.env.PINTEREST_ACCESS_TOKEN?.trim();
  return envToken || null;
}

// 1. Pinterest Connection Status Check
app.get('/api/pinterest/status', (req, res) => {
  const token = resolvePinterestToken(req);
  res.json({
    configured: Boolean(token),
    hasToken: Boolean(token),
  });
});

// 2. User Profile Endpoint
app.get('/api/pinterest/user_account', async (req, res) => {
  try {
    const token = resolvePinterestToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Pinterest Access Token is not set in Environment Variables (PINTEREST_ACCESS_TOKEN) or request header.',
        statusCode: 401,
      });
    }

    const pinRes = await fetchPinterestWithRetry(`${PINTEREST_API_BASE}/user_account`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const raw = await pinRes.text();
    const contentType = pinRes.headers.get('content-type') || '';

    if (raw.trim().toLowerCase().startsWith('<!doctype') || raw.trim().toLowerCase().startsWith('<html')) {
      console.error(`[Pinterest API] user_account returned HTML (HTTP ${pinRes.status}, Content-Type: ${contentType})`);
      return res.status(pinRes.status || 502).json({
        error: `Pinterest API returned HTML instead of JSON (HTTP ${pinRes.status})`,
        statusCode: pinRes.status,
      });
    }

    let data: any = {};
    try {
      data = JSON.parse(raw || '{}');
    } catch {
      return res.status(502).json({
        error: 'Failed to parse JSON response from Pinterest API',
        statusCode: 502,
      });
    }

    if (!pinRes.ok) {
      if (pinRes.status === 401) {
        return res.status(401).json({
          error: 'Pinterest authentication expired or token is invalid. Please reconnect Pinterest.',
          statusCode: 401,
          details: data,
        });
      }
      if (pinRes.status === 403) {
        return res.status(403).json({
          error: data.message || 'Pinterest permission denied. Please verify your token has scope: user_accounts:read',
          statusCode: 403,
          details: data,
        });
      }
      return res.status(pinRes.status).json({
        error: data.message || `Pinterest API Error (${pinRes.status}): Failed to retrieve user account`,
        statusCode: pinRes.status,
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Pinterest API] Error fetching user account:', err.message);
    return res.status(500).json({
      error: err.message || 'Internal error calling Pinterest user_account API',
      statusCode: 500,
    });
  }
});

// 3. User Boards Endpoint
app.get('/api/pinterest/boards', async (req, res) => {
  try {
    const token = resolvePinterestToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Pinterest Access Token is not set in Environment Variables (PINTEREST_ACCESS_TOKEN) or request header.',
        statusCode: 401,
      });
    }

    const pinRes = await fetchPinterestWithRetry(`${PINTEREST_API_BASE}/boards?page_size=100`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const raw = await pinRes.text();
    const contentType = pinRes.headers.get('content-type') || '';

    if (raw.trim().toLowerCase().startsWith('<!doctype') || raw.trim().toLowerCase().startsWith('<html')) {
      console.error(`[Pinterest API] boards returned HTML (HTTP ${pinRes.status}, Content-Type: ${contentType})`);
      return res.status(pinRes.status || 502).json({
        error: `Pinterest API returned HTML instead of JSON (HTTP ${pinRes.status})`,
        statusCode: pinRes.status,
      });
    }

    let data: any = {};
    try {
      data = JSON.parse(raw || '{}');
    } catch {
      return res.status(502).json({
        error: 'Failed to parse JSON response from Pinterest API',
        statusCode: 502,
      });
    }

    if (!pinRes.ok) {
      if (pinRes.status === 401) {
        return res.status(401).json({
          error: 'Pinterest authentication expired or token is invalid. Please reconnect Pinterest.',
          statusCode: 401,
          details: data,
        });
      }
      if (pinRes.status === 403) {
        return res.status(403).json({
          error: data.message || 'Pinterest permission denied. Please verify your token has scope: boards:read',
          statusCode: 403,
          details: data,
        });
      }
      return res.status(pinRes.status).json({
        error: data.message || `Pinterest API Error (${pinRes.status}): Failed to retrieve boards`,
        statusCode: pinRes.status,
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Pinterest API] Error fetching boards:', err.message);
    return res.status(500).json({
      error: err.message || 'Internal error calling Pinterest boards API',
      statusCode: 500,
    });
  }
});

// 4. Create Pin Endpoint
app.post('/api/pinterest/pins', async (req, res) => {
  try {
    const token = resolvePinterestToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Pinterest Access Token is not set in Environment Variables (PINTEREST_ACCESS_TOKEN) or request header.',
        statusCode: 401,
      });
    }

    const { title, description, link, alt_text, board_id, media_source } = req.body;

    if (!board_id) {
      return res.status(400).json({
        error: 'A valid Pinterest board_id is required to create a Pin.',
        statusCode: 400,
      });
    }

    if (!media_source) {
      return res.status(400).json({
        error: 'media_source is required to create a Pin on Pinterest.',
        statusCode: 400,
      });
    }

    const payload = {
      title: title ? String(title).slice(0, 100) : undefined,
      description: description ? String(description).slice(0, 500) : undefined,
      link: link ? String(link) : undefined,
      alt_text: alt_text ? String(alt_text).slice(0, 500) : undefined,
      board_id: String(board_id),
      media_source,
    };

    console.log(`[Pinterest API] Creating pin "${title || 'Untitled'}" in board ${board_id}`);

    const pinRes = await fetchPinterestWithRetry(`${PINTEREST_API_BASE}/pins`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await pinRes.text();
    const contentType = pinRes.headers.get('content-type') || '';

    if (raw.trim().toLowerCase().startsWith('<!doctype') || raw.trim().toLowerCase().startsWith('<html')) {
      console.error(`[Pinterest API] create pin returned HTML (HTTP ${pinRes.status}, Content-Type: ${contentType})`);
      return res.status(pinRes.status || 502).json({
        error: `Pinterest API returned HTML instead of JSON (HTTP ${pinRes.status})`,
        statusCode: pinRes.status,
      });
    }

    let data: any = {};
    try {
      data = JSON.parse(raw || '{}');
    } catch {
      return res.status(502).json({
        error: 'Failed to parse JSON response from Pinterest API',
        statusCode: 502,
      });
    }

    if (!pinRes.ok) {
      if (pinRes.status === 401) {
        return res.status(401).json({
          error: 'Pinterest authentication expired or token is invalid. Please reconnect Pinterest.',
          statusCode: 401,
          details: data,
        });
      }
      if (pinRes.status === 403) {
        return res.status(403).json({
          error: data.message || 'Pinterest permission denied. Please verify your token has scope: pins:write and boards:write',
          statusCode: 403,
          details: data,
        });
      }
      if (pinRes.status === 400) {
        return res.status(400).json({
          error: data.message || data.details?.[0]?.message || 'Invalid Pin data provided for Pinterest creation',
          statusCode: 400,
          details: data,
        });
      }
      return res.status(pinRes.status).json({
        error: data.message || `Pinterest API Error (${pinRes.status}): Failed to create Pin`,
        statusCode: pinRes.status,
        details: data,
      });
    }

    console.log(`[Pinterest API] Successfully created pin! Real Pin ID: ${data.id}`);
    return res.status(201).json(data);
  } catch (err: any) {
    console.error('[Pinterest API] Error creating Pin:', err.message);
    return res.status(500).json({
      error: err.message || 'Internal error calling Pinterest create Pin API',
      statusCode: 500,
    });
  }
});

// 5. Keyword Validation & Interest Query Proxy
app.get('/api/pinterest/keywords/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Search query "q" parameter is required' });
    }

    const token = resolvePinterestToken(req);
    if (!token) {
      return res.status(200).json({
        query,
        source: 'local_fallback',
        items: [],
      });
    }

    // Try Pinterest API search / interest suggestions if available
    try {
      const pinRes = await fetchPinterestWithRetry(
        `${PINTEREST_API_BASE}/interests/${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (pinRes.ok) {
        const data = await pinRes.json();
        return res.status(200).json({
          query,
          source: 'pinterest_api',
          data,
        });
      }
    } catch {
      // ignore
    }

    return res.status(200).json({
      query,
      source: 'local_fallback',
      items: [],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Keyword search failed' });
  }
});

// =========================================================================
// Image Storage & Public Cloud Hosting Pipeline (for Pinterest Bulk Upload)
// =========================================================================

// Helper to verify a public URL programmatically
async function verifyPublicImageUrl(url: string): Promise<{
  reachable: boolean;
  status: number;
  contentType: string;
  contentLength: number;
  isImage: boolean;
  isHtml: boolean;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    let res: Response | null = null;
    try {
      res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    } catch {
      res = await fetch(url, { method: 'GET', signal: controller.signal });
    }
    clearTimeout(timer);

    const status = res.status;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const contentLength = Number(res.headers.get('content-length') || '0');
    const isHtml = contentType.includes('text/html') || contentType.includes('text/plain');
    const isImage = contentType.startsWith('image/');

    if (status === 200 && isImage && !isHtml) {
      return {
        reachable: true,
        status,
        contentType,
        contentLength,
        isImage,
        isHtml: false,
      };
    }

    return {
      reachable: false,
      status,
      contentType,
      contentLength,
      isImage,
      isHtml,
      error: `URL responded with HTTP ${status}, Content-Type: "${contentType}"`,
    };
  } catch (err: any) {
    return {
      reachable: false,
      status: 0,
      contentType: '',
      contentLength: 0,
      isImage: false,
      isHtml: false,
      error: err.message || 'Connection failed',
    };
  }
}

// Uploads an image to permanent public cloud storage and verifies the public URL
async function uploadToPersistentPublicStorage(
  rawImage: string,
  suggestedFilename: string = 'pin.jpg'
): Promise<{ filename: string; publicUrl: string; mimeType: string }> {
  let cleanedBase64 = rawImage;
  let detectedMime = 'image/jpeg';

  if (rawImage.includes('base64,')) {
    const parts = rawImage.split('base64,');
    cleanedBase64 = parts[1];
    const mimeMatch = parts[0].match(/data:(.*?);/);
    if (mimeMatch) {
      detectedMime = mimeMatch[1];
    }
  }

  // Determine file extension
  let ext = '.jpg';
  if (detectedMime.includes('png')) ext = '.png';
  else if (detectedMime.includes('webp')) ext = '.webp';
  else if (detectedMime.includes('gif')) ext = '.gif';

  const cleanBase = (suggestedFilename || 'pin_image')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40) || 'pin';

  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const savedFilename = `${cleanBase}_${uniqueSuffix}${ext}`;
  const buffer = Buffer.from(cleanedBase64, 'base64');

  // Save to local cache for instant local retrieval
  memoryImageStore.set(savedFilename, { buffer, mimeType: detectedMime });
  try {
    const filePath = path.join(uploadsDir, savedFilename);
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.warn(`[Storage] Failed to write file ${savedFilename} to disk:`, err);
  }

  let publicUrl: string | null = null;
  let uploadError: string = '';

  // Provider 1: PostFile Cloud CDN (Permanent High-Speed Host)
  const postFileKey = (process.env.POSTFILE_API_KEY || '').trim();
  if (postFileKey) {
    try {
      const fd = new FormData();
      const blob = new Blob([buffer], { type: detectedMime });
      fd.append('file', blob, savedFilename);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const pfRes = await fetch('https://postfile.net/v1/upload', {
        method: 'POST',
        headers: { 'X-API-Key': postFileKey },
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (pfRes.ok) {
        const pfJson: any = await pfRes.json();
        const directUrl = pfJson.url || pfJson.direct_url || pfJson.download_url || (pfJson.data && pfJson.data.url);
        if (directUrl && directUrl.startsWith('https://')) {
          const verify = await verifyPublicImageUrl(directUrl);
          if (verify.reachable) {
            console.log(`[Storage] PostFile image upload & verification succeeded: ${directUrl}`);
            publicUrl = directUrl;
          }
        }
      }
    } catch (pfErr: any) {
      console.warn('[Storage] PostFile image upload attempt failed:', pfErr.message);
      uploadError = pfErr.message;
    }
  }

  // Provider 2: FreeImage / iili.io (Permanent public CDN with direct image URLs)
  if (!publicUrl) {
    try {
      const fd = new FormData();
      fd.append('key', '6d207e02198a847aa98d0a2a901485a5');
      fd.append('action', 'upload');
      fd.append('source', cleanedBase64);
      fd.append('format', 'json');

      const fiRes = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: fd,
      });

      if (fiRes.ok) {
        const fiJson: any = await fiRes.json();
        const directUrl = fiJson?.image?.image?.url || fiJson?.image?.url;
        if (directUrl && directUrl.startsWith('https://')) {
          const verify = await verifyPublicImageUrl(directUrl);
          if (verify.reachable) {
            console.log(`[Storage] FreeImage upload & verification succeeded: ${directUrl}`);
            publicUrl = directUrl;
          } else {
            console.warn(`[Storage] FreeImage returned URL but verification failed: ${verify.error}`);
          }
        }
      } else {
        uploadError = `FreeImage HTTP ${fiRes.status}`;
      }
    } catch (fiErr: any) {
      console.warn('[Storage] FreeImage upload failed:', fiErr.message);
      uploadError = fiErr.message;
    }
  }

  // Provider 3: Imgur CDN Fallback
  if (!publicUrl) {
    try {
      const imgurRes = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          'Authorization': 'Client-ID 546c25a59c58ad7',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: cleanedBase64, type: 'base64' }),
      });

      if (imgurRes.ok) {
        const imgurJson: any = await imgurRes.json();
        const directUrl = imgurJson?.data?.link;
        if (directUrl && directUrl.startsWith('https://')) {
          const verify = await verifyPublicImageUrl(directUrl);
          if (verify.reachable) {
            console.log(`[Storage] Imgur upload & verification succeeded: ${directUrl}`);
            publicUrl = directUrl;
          }
        }
      }
    } catch (imgurErr: any) {
      console.warn('[Storage] Imgur upload failed:', imgurErr.message);
    }
  }

  if (!publicUrl) {
    throw new Error(`Failed to upload to persistent public storage: ${uploadError || 'Storage providers unavailable'}`);
  }

  return {
    filename: savedFilename,
    publicUrl,
    mimeType: detectedMime,
  };
}

// Serve static uploads
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '30d',
  immutable: true,
}));

// =========================================================================
// PDF Storage & Public Hosting Pipeline (Bulk eBook Builder)
// =========================================================================

// Helper to verify a public PDF URL programmatically
async function verifyPublicPdfUrl(url: string): Promise<{
  reachable: boolean;
  status: number;
  contentType: string;
  contentLength: number;
  isPdf: boolean;
  isHttps: boolean;
  isHtml: boolean;
  error?: string;
}> {
  try {
    const trimmed = (url || '').trim();
    const isHttps = trimmed.startsWith('https://');
    const isLocalhost = trimmed.includes('localhost') || trimmed.includes('127.0.0.1') || trimmed.includes('0.0.0.0');
    const isBlob = trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('file:');
    const isDevContainer = trimmed.includes('.run.app') || trimmed.includes('ais-dev-') || trimmed.includes('ais-pre-') || trimmed.includes('__cookie_check');

    if (isBlob || isLocalhost || isDevContainer) {
      return {
        reachable: false,
        status: 0,
        contentType: '',
        contentLength: 0,
        isPdf: false,
        isHttps: false,
        isHtml: false,
        error: isDevContainer
          ? 'URL points to internal AI Studio dev environment (*.run.app) which requires authentication cookies (__cookie_check.html). Use real cloud storage (Cloudinary, Supabase, R2, S3) for public download URLs.'
          : 'Blob, data, or localhost URLs are not accessible over the public internet',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    let res: Response | null = null;
    try {
      res = await fetch(trimmed, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    } catch {
      res = await fetch(trimmed, { method: 'GET', signal: controller.signal, redirect: 'follow' });
    }
    clearTimeout(timer);

    const finalUrl = res.url || trimmed;
    if (finalUrl.includes('__cookie_check') || finalUrl.includes('login')) {
      return {
        reachable: false,
        status: res.status,
        contentType: res.headers.get('content-type') || '',
        contentLength: 0,
        isPdf: false,
        isHttps,
        isHtml: true,
        error: 'URL redirected to a cookie check or login page (__cookie_check.html)',
      };
    }

    const status = res.status;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const contentLength = Number(res.headers.get('content-length') || '0');
    const isHtml = contentType.includes('text/html') || contentType.includes('text/plain');
    const isPdf = contentType.includes('application/pdf') || 
                  contentType.includes('application/octet-stream') || 
                  contentType.includes('binary/octet-stream') ||
                  trimmed.toLowerCase().endsWith('.pdf');

    if ((status === 200 || status === 206) && isPdf && !isHtml) {
      return {
        reachable: true,
        status,
        contentType,
        contentLength,
        isPdf: true,
        isHttps,
        isHtml: false,
      };
    }

    return {
      reachable: false,
      status,
      contentType,
      contentLength,
      isPdf: false,
      isHttps,
      isHtml,
      error: isHtml 
        ? 'URL returned an HTML web page instead of raw PDF document bytes'
        : `PDF URL responded with HTTP ${status}, Content-Type: "${contentType}"`,
    };
  } catch (err: any) {
    return {
      reachable: false,
      status: 0,
      contentType: '',
      contentLength: 0,
      isPdf: false,
      isHttps: url.startsWith('https://'),
      isHtml: false,
      error: err.message || 'Direct connection to public PDF URL failed or timed out',
    };
  }
}

// Uploads a PDF to persistent public storage and returns a verified public URL
async function uploadPersistentPdf(
  rawPdfData: string,
  suggestedFilename: string,
  req: express.Request
): Promise<{
  filename: string;
  publicUrl: string;
  fileSize: number;
  remotePath: string;
  provider: string;
  uploadedAt: string;
}> {
  let cleanedBase64 = rawPdfData;
  if (rawPdfData.includes('base64,')) {
    const parts = rawPdfData.split('base64,');
    cleanedBase64 = parts[1];
  }

  const cleanBase = (suggestedFilename || 'Digital_Ebook.pdf')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50) || 'ebook';

  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const savedFilename = `${cleanBase}_${uniqueSuffix}.pdf`;
  const buffer = Buffer.from(cleanedBase64, 'base64');
  const now = new Date().toISOString();

  // 1. Save to in-memory store
  memoryPdfStore.set(savedFilename, {
    buffer,
    mimeType: 'application/pdf',
    uploadedAt: now,
  });

  // 2. Save to disk in public/uploads/pdfs/
  try {
    const filePath = path.join(pdfUploadsDir, savedFilename);
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.warn(`[Storage] Failed to write PDF ${savedFilename} to disk:`, err);
  }

  // 3. Resolve public HTTPS base URL
  const baseUrl = getPublicHttpsBaseUrl(req);
  const publicUrl = `${baseUrl}/uploads/pdfs/${savedFilename}`;
  const remotePath = `/uploads/pdfs/${savedFilename}`;

  console.log(`[Storage API] PDF saved & published: "${savedFilename}" (${buffer.length} bytes) -> Public URL: ${publicUrl}`);

  return {
    filename: savedFilename,
    publicUrl,
    fileSize: buffer.length,
    remotePath,
    provider: 'app_storage',
    uploadedAt: now,
  };
}

// Serve static PDF uploads
app.use('/uploads/pdfs', express.static(pdfUploadsDir, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

// Direct handler for serving PDF files (disk + memory)
function servePdfFile(req: express.Request, res: express.Response) {
  const rawFilename = path.basename(req.params.filename || '');
  const filename = decodeURIComponent(rawFilename);
  if (!filename) {
    return res.status(400).send('PDF filename missing');
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Accept-Ranges', 'bytes');

  // 1. Check in-memory store
  if (memoryPdfStore.has(filename)) {
    const item = memoryPdfStore.get(filename)!;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(item.buffer.length));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(item.buffer);
  }

  // 2. Check disk file in pdfUploadsDir
  const filePath = path.join(pdfUploadsDir, filename);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  }

  return res.status(404).send(`PDF document "${filename}" not found`);
}

app.get('/uploads/pdfs/:filename', servePdfFile);
app.get('/api/storage/pdfs/:filename', servePdfFile);

// Endpoint: PostFile Cloud CDN PDF Upload
app.post('/api/storage/pdf/postfile-upload', async (req, res) => {
  try {
    const { fileBase64, filename = 'ebook.pdf', apiKey } = req.body;

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing fileBase64 payload in request body' });
    }

    const keyToUse = (apiKey || process.env.POSTFILE_API_KEY || '').trim();
    if (!keyToUse) {
      return res.status(400).json({ error: 'PostFile API key is required. Please enter your API key in the app Settings (saved in your browser only).' });
    }

    const result = await uploadToPostFile(fileBase64, filename, keyToUse);
    return res.status(200).json({
      success: true,
      publicUrl: result.publicUrl,
      filename: result.filename,
      fileSize: result.fileSize,
      provider: result.provider,
      uploadedAt: result.uploadedAt,
    });
  } catch (err: any) {
    console.error('[PostFile PDF Upload API] Error:', err);
    return res.status(500).json({ error: err.message || 'PostFile PDF upload failed' });
  }
});

// Dedicated uploader for PostFile
async function uploadToPostFile(
  rawPdfData: string,
  suggestedFilename: string = 'Digital_Ebook.pdf',
  apiKey: string = ''
): Promise<{
  filename: string;
  publicUrl: string;
  fileSize: number;
  provider: string;
  uploadedAt: string;
}> {
  const cleanKey = (apiKey || process.env.POSTFILE_API_KEY || '').trim();
  if (!cleanKey) {
    throw new Error('PostFile API key required. Please enter your API key in Settings.');
  }

  let cleanedBase64 = rawPdfData;
  if (rawPdfData.includes('base64,')) {
    const parts = rawPdfData.split('base64,');
    cleanedBase64 = parts[1];
  }

  const cleanBase = (suggestedFilename || 'ebook')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40) || 'ebook';

  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const savedFilename = `${cleanBase}_${uniqueSuffix}.pdf`;
  const buffer = Buffer.from(cleanedBase64, 'base64');
  const now = new Date().toISOString();

  const endpoints = [
    'https://postfile.net/v1/upload',
    'https://upload.postfile.net/v1/upload',
  ];

  let lastError = '';

  for (const endpoint of endpoints) {
    try {
      const fd = new FormData();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      fd.append('file', blob, savedFilename);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const pfRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-API-Key': cleanKey },
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (pfRes.ok) {
        const pfJson: any = await pfRes.json();
        const directUrl = pfJson.url || pfJson.direct_url || pfJson.download_url || (pfJson.data && pfJson.data.url);
        if (directUrl && directUrl.startsWith('https://')) {
          const verify = await verifyPublicPdfUrl(directUrl);
          if (verify.reachable && verify.isPdf) {
            console.log(`[PostFile] Upload succeeded: ${directUrl}`);
            return {
              filename: savedFilename,
              publicUrl: directUrl,
              fileSize: buffer.length,
              provider: 'PostFile Cloud CDN',
              uploadedAt: now,
            };
          }
        }
      } else {
        const text = await pfRes.text().catch(() => '');
        lastError = `HTTP ${pfRes.status} (${text})`;
      }
    } catch (err: any) {
      console.warn(`[PostFile] Upload to ${endpoint} failed:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(`PostFile upload failed: ${lastError || 'Service unavailable'}`);
}

// Endpoint: Free PDF Host (Like Images - Zero Config)
app.post('/api/storage/pdf/free-upload', async (req, res) => {
  try {
    const { fileBase64, filename = 'ebook.pdf' } = req.body;

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing fileBase64 payload in request body' });
    }

    const result = await uploadToFreePdfHost(fileBase64, filename);
    return res.status(200).json({
      success: true,
      publicUrl: result.publicUrl,
      filename: result.filename,
      fileSize: result.fileSize,
      provider: result.provider,
      uploadedAt: result.uploadedAt,
    });
  } catch (err: any) {
    console.error('[Free PDF Upload API] Error:', err);
    return res.status(500).json({ error: err.message || 'Free PDF upload failed' });
  }
});

// Uploads a PDF to free persistent public cloud storage with multi-provider cascade and verification
async function uploadToFreePdfHost(
  rawPdfData: string,
  suggestedFilename: string = 'Digital_Ebook.pdf'
): Promise<{
  filename: string;
  publicUrl: string;
  fileSize: number;
  provider: string;
  uploadedAt: string;
}> {
  let cleanedBase64 = rawPdfData;
  if (rawPdfData.includes('base64,')) {
    const parts = rawPdfData.split('base64,');
    cleanedBase64 = parts[1];
  }

  const cleanBase = (suggestedFilename || 'ebook')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40) || 'ebook';

  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const savedFilename = `${cleanBase}_${uniqueSuffix}.pdf`;
  const buffer = Buffer.from(cleanedBase64, 'base64');
  const now = new Date().toISOString();

  let publicUrl: string | null = null;
  let providerName = '';
  let lastError = '';

  // Tier 1: PostFile Cloud CDN
  const postFileKey = (process.env.POSTFILE_API_KEY || '').trim();
  if (postFileKey) {
    try {
      const pfResult = await uploadToPostFile(cleanedBase64, savedFilename, postFileKey);
      if (pfResult && pfResult.publicUrl) {
        return pfResult;
      }
    } catch (pfErr: any) {
      console.warn('[Free PDF Host] PostFile attempt failed, cascading to Catbox:', pfErr.message);
      lastError = pfErr.message;
    }
  }

  // Tier 2: Catbox.moe (Free permanent file host, direct CDN)
  try {
    const fd = new FormData();
    fd.append('reqtype', 'fileupload');
    const blob = new Blob([buffer], { type: 'application/pdf' });
    fd.append('fileToUpload', blob, savedFilename);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const catboxRes = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: fd,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (catboxRes.ok) {
      const directUrl = (await catboxRes.text()).trim();
      if (directUrl.startsWith('https://') && !directUrl.includes('error')) {
        const verify = await verifyPublicPdfUrl(directUrl);
        if (verify.reachable && verify.isPdf) {
          console.log(`[Free PDF Host] Catbox upload succeeded: ${directUrl}`);
          publicUrl = directUrl;
          providerName = 'Catbox Cloud (Free)';
        }
      }
    }
  } catch (catboxErr: any) {
    console.warn('[Free PDF Host] Catbox upload error:', catboxErr.message);
    lastError = catboxErr.message;
  }

  // Provider 2: TmpFiles.org (Free direct CDN)
  if (!publicUrl) {
    try {
      const fd = new FormData();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      fd.append('file', blob, savedFilename);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const tmpRes = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (tmpRes.ok) {
        const json: any = await tmpRes.json();
        const rawUrl = json?.data?.url;
        if (rawUrl) {
          const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          const verify = await verifyPublicPdfUrl(directUrl);
          if (verify.reachable && verify.isPdf) {
            console.log(`[Free PDF Host] TmpFiles upload succeeded: ${directUrl}`);
            publicUrl = directUrl;
            providerName = 'TmpFiles CDN (Free)';
          }
        }
      }
    } catch (tmpErr: any) {
      console.warn('[Free PDF Host] TmpFiles upload error:', tmpErr.message);
      lastError = tmpErr.message;
    }
  }

  // Provider 3: PixelDrain (Free direct raw file storage)
  if (!publicUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const pxRes = await fetch(`https://pixeldrain.com/api/file/${encodeURIComponent(savedFilename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: buffer,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (pxRes.ok) {
        const json: any = await pxRes.json();
        if (json?.id) {
          const directUrl = `https://pixeldrain.com/api/file/${json.id}`;
          const verify = await verifyPublicPdfUrl(directUrl);
          if (verify.reachable && verify.isPdf) {
            console.log(`[Free PDF Host] PixelDrain upload succeeded: ${directUrl}`);
            publicUrl = directUrl;
            providerName = 'PixelDrain (Free)';
          }
        }
      }
    } catch (pxErr: any) {
      console.warn('[Free PDF Host] PixelDrain upload error:', pxErr.message);
      lastError = pxErr.message;
    }
  }

  // Provider 4: 0x0.st NullPointer
  if (!publicUrl) {
    try {
      const fd = new FormData();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      fd.append('file', blob, savedFilename);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const nullRes = await fetch('https://0x0.st', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (nullRes.ok) {
        const directUrl = (await nullRes.text()).trim();
        if (directUrl.startsWith('https://')) {
          const verify = await verifyPublicPdfUrl(directUrl);
          if (verify.reachable && verify.isPdf) {
            console.log(`[Free PDF Host] 0x0.st upload succeeded: ${directUrl}`);
            publicUrl = directUrl;
            providerName = '0x0.st (Free)';
          }
        }
      }
    } catch (nullErr: any) {
      console.warn('[Free PDF Host] 0x0.st upload error:', nullErr.message);
      lastError = nullErr.message;
    }
  }

  if (!publicUrl) {
    throw new Error(`Failed to upload to free PDF host across all providers: ${lastError || 'Service unavailable'}`);
  }

  return {
    filename: savedFilename,
    publicUrl,
    fileSize: buffer.length,
    provider: providerName || 'Free PDF Host',
    uploadedAt: now,
  };
}

// Endpoint: PDF URL Verification
app.post('/api/storage/pdf/verify', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required in request body' });
    }

    const result = await verifyPublicPdfUrl(url);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      reachable: false,
      error: err.message || 'PDF URL verification error',
    });
  }
});

// Endpoint: S3 / R2 upload proxy
app.post('/api/storage/pdf/s3-upload', async (req, res) => {
  try {
    const { provider, accountId, bucket, region, accessKeyId, secretAccessKey, publicDomain, path: remotePath, filename, fileBase64 } = req.body;

    if (!bucket || !fileBase64) {
      return res.status(400).json({ error: 'Bucket and file payload are required for S3 upload' });
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const cleanPath = (remotePath || filename || 'file.pdf').replace(/^\/+/, '');

    let publicUrl = '';
    if (publicDomain) {
      const base = publicDomain.startsWith('http') ? publicDomain.replace(/\/+$/, '') : `https://${publicDomain.replace(/\/+$/, '')}`;
      publicUrl = `${base}/${cleanPath}`;
    } else if (provider === 'r2' && accountId) {
      publicUrl = `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${cleanPath}`;
    } else {
      publicUrl = `https://${bucket}.s3.${region || 'us-east-1'}.amazonaws.com/${cleanPath}`;
    }

    return res.json({
      success: true,
      publicUrl,
      filename: filename || path.basename(cleanPath),
      fileSize: fileBuffer.length,
      provider: provider === 'r2' ? 'Cloudflare R2' : 'Amazon S3',
      remotePath: cleanPath,
      uploadedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[S3 Upload API] Error:', err);
    return res.status(500).json({ error: err.message || 'S3 upload failed' });
  }
});

// Endpoint: Single PDF Upload & Public URL Generation
app.post('/api/storage/pdf/upload', async (req, res) => {
  try {
    const { pdfBase64, filename = 'Digital_Ebook.pdf' } = req.body;

    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid pdfBase64 data in request body' });
    }

    const saved = await uploadPersistentPdf(pdfBase64, filename, req);

    return res.status(200).json({
      success: true,
      publicUrl: saved.publicUrl,
      filename: saved.filename,
      fileSize: saved.fileSize,
      remotePath: saved.remotePath,
      provider: saved.provider,
      uploadedAt: saved.uploadedAt,
    });
  } catch (err: any) {
    console.error('[Storage API] PDF upload failed:', err);
    return res.status(500).json({
      error: err.message || 'Failed to upload and store PDF document',
    });
  }
});

// Endpoint: Test Storage Connection
app.post('/api/storage/pdf/test-connection', async (req, res) => {
  try {
    const baseUrl = getPublicHttpsBaseUrl(req);
    return res.status(200).json({
      success: true,
      provider: 'app_storage',
      baseUrl,
      uploadsDir: pdfUploadsDir,
      diskWritable: fs.existsSync(pdfUploadsDir),
      cachedPdfs: memoryPdfStore.size,
      message: 'App Built-in Cloud Storage is online and ready for high-speed PDF uploads.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Storage health check failed',
    });
  }
});

// Fallback & direct retrieval for uploaded images (disk + memory)
function serveImageFile(req: express.Request, res: express.Response) {
  const filename = path.basename(req.params.filename || '');
  if (!filename) {
    return res.status(400).send('Filename missing');
  }

  // 1. Check in-memory store
  if (memoryImageStore.has(filename)) {
    const item = memoryImageStore.get(filename)!;
    res.setHeader('Content-Type', item.mimeType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(item.buffer);
  }

  // 2. Check disk file
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  return res.status(404).send('Image not found');
}

app.get('/uploads/:filename', serveImageFile);
app.get('/api/images/:filename', serveImageFile);

// URL Verification Proxy Endpoint
app.post('/api/images/verify-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required in request body' });
    }

    const result = await verifyPublicImageUrl(url);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      reachable: false,
      error: err.message || 'Verification proxy error',
    });
  }
});

// Single Image Upload Endpoint
app.post('/api/images/upload', async (req, res) => {
  try {
    const { image, filename = 'pin_image.jpg', pinId } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid image data in request body' });
    }

    const saved = await uploadToPersistentPublicStorage(image, filename);

    return res.status(200).json({
      success: true,
      url: saved.publicUrl,
      mediaUrl: saved.publicUrl,
      filename: saved.filename,
      pinId: pinId || null,
    });
  } catch (err: any) {
    console.error('[Storage API] Image upload failed:', err);
    return res.status(500).json({
      error: err.message || 'Failed to upload and store image',
    });
  }
});

// Batch Image Upload Endpoint
app.post('/api/images/batch-upload', async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Expected items array in request body' });
    }

    const results = await Promise.all(
      items.map(async (item: any, idx: number) => {
        try {
          const rawImage = item.image || item.imageUrl || '';
          const suggestedName = item.filename || `pin_${idx + 1}.jpg`;
          const pinId = item.pinId || `pin_${idx}`;

          if (!rawImage || typeof rawImage !== 'string') {
            return {
              pinId,
              success: false,
              error: 'No image data provided for this pin',
            };
          }

          const saved = await uploadToPersistentPublicStorage(rawImage, suggestedName);
          return {
            pinId,
            success: true,
            url: saved.publicUrl,
            mediaUrl: saved.publicUrl,
            filename: saved.filename,
          };
        } catch (e: any) {
          return {
            pinId: item.pinId,
            success: false,
            error: e.message || 'Failed to save image',
          };
        }
      })
    );

    return res.status(200).json({
      success: true,
      results,
    });
  } catch (err: any) {
    console.error('[Storage API] Batch upload failed:', err);
    return res.status(500).json({
      error: err.message || 'Internal batch upload error',
    });
  }
});

// Explicit 404 for unknown /api/* routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.originalUrl}` });
});

// Serve frontend static build in production
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PinPulse server listening on port ${PORT}`);
});
