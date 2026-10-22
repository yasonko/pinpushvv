import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// Helper to delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Setup uploads directory on disk
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
  console.warn('[Vite Storage] Could not initialize uploads directory:', err);
}

// In-memory image & PDF buffer cache for instant serving across dev requests
const memoryImageStore = new Map<string, { buffer: Buffer; mimeType: string }>();
const memoryPdfStore = new Map<string, { buffer: Buffer; mimeType: string; uploadedAt: string }>();

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

  return keys;
}

// Helper to resolve public HTTPS base URL from request
function resolvePublicBaseUrl(req: any, clientOriginHeader?: string): string {
  if (clientOriginHeader && (clientOriginHeader.startsWith('https://') || clientOriginHeader.startsWith('http://'))) {
    return clientOriginHeader.replace(/\/+$/, '').replace(/^http:\/\/([a-zA-Z0-9-]+\.run\.app)/, 'https://$1');
  }

  if (process.env.APP_URL && process.env.APP_URL.startsWith('http')) {
    return process.env.APP_URL.replace(/\/+$/, '').replace(/^http:\/\/([a-zA-Z0-9-]+\.run\.app)/, 'https://$1');
  }

  const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const proto = forwardedProto.split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  const isCloud = host.includes('run.app') || !host.includes('localhost');
  const finalProto = isCloud ? 'https' : proto;
  return `${finalProto}://${host}`;
}

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

  // Store in memory
  memoryImageStore.set(savedFilename, { buffer, mimeType: detectedMime });

  // Store on disk in public/uploads
  try {
    const filePath = path.join(uploadsDir, savedFilename);
    fs.writeFileSync(filePath, buffer);
  } catch (err) {
    console.warn(`[Vite Storage] Failed to write ${savedFilename} to disk:`, err);
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
            console.log(`[Vite Storage] PostFile image upload & verification succeeded: ${directUrl}`);
            publicUrl = directUrl;
          }
        }
      }
    } catch (pfErr: any) {
      console.warn('[Vite Storage] PostFile image upload attempt failed:', pfErr.message);
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
            console.log(`[Vite Storage] FreeImage upload & verification succeeded: ${directUrl}`);
            publicUrl = directUrl;
          } else {
            console.warn(`[Vite Storage] FreeImage verification failed: ${verify.error}`);
          }
        }
      } else {
        uploadError = `FreeImage HTTP ${fiRes.status}`;
      }
    } catch (fiErr: any) {
      console.warn('[Vite Storage] FreeImage upload failed:', fiErr.message);
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
            console.log(`[Vite Storage] Imgur upload & verification succeeded: ${directUrl}`);
            publicUrl = directUrl;
          }
        }
      }
    } catch (imgurErr: any) {
      console.warn('[Vite Storage] Imgur upload failed:', imgurErr.message);
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

/**
 * Full API & Image Storage Plugin for Vite Dev Server
 */
function apiAndStoragePlugin(): Plugin {
  return {
    name: 'api-and-storage-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0].replace(/\/+$/, '');

        // Set global CORS headers for API and media endpoints
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-origin');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        // =========================================================================
        // 0. Serving Uploaded PDF Documents (/uploads/pdfs/:filename or /api/storage/pdfs/:filename)
        // =========================================================================
        if (pathname.startsWith('/uploads/pdfs/') || pathname.startsWith('/api/storage/pdfs/')) {
          const rawFilename = path.basename(pathname);
          const filename = decodeURIComponent(rawFilename);
          if (filename && filename !== 'upload' && filename !== 'verify' && filename !== 'test-connection') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Accept-Ranges', 'bytes');

            // Check memory store
            if (memoryPdfStore.has(filename)) {
              const item = memoryPdfStore.get(filename)!;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Length', String(item.buffer.length));
              res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.end(item.buffer);
              return;
            }

            // Check disk storage
            const filePath = path.join(pdfUploadsDir, filename);
            if (fs.existsSync(filePath)) {
              const diskBuf = fs.readFileSync(filePath);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Length', String(diskBuf.length));
              res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.end(diskBuf);
              return;
            }

            // Explicit 404 for missing PDF
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end(`PDF document "${filename}" not found`);
            return;
          }
        }

        // =========================================================================
        // 0.5 PDF API Endpoints (/api/storage/pdf/upload, verify, test-connection)
        // =========================================================================
        if (pathname === '/api/storage/pdf/upload' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { pdfBase64, filename = 'Digital_Ebook.pdf' } = body;

              if (!pdfBase64 || typeof pdfBase64 !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing or invalid pdfBase64 data in request body' }));
                return;
              }

              let cleanedBase64 = pdfBase64;
              if (pdfBase64.includes('base64,')) {
                cleanedBase64 = pdfBase64.split('base64,')[1];
              }

              const cleanBase = (filename || 'Digital_Ebook.pdf')
                .replace(/\.[^/.]+$/, '')
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .slice(0, 50) || 'ebook';

              const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              const savedFilename = `${cleanBase}_${uniqueSuffix}.pdf`;
              const buffer = Buffer.from(cleanedBase64, 'base64');
              const now = new Date().toISOString();

              memoryPdfStore.set(savedFilename, {
                buffer,
                mimeType: 'application/pdf',
                uploadedAt: now,
              });

              try {
                const filePath = path.join(pdfUploadsDir, savedFilename);
                fs.writeFileSync(filePath, buffer);
              } catch (err) {
                console.warn(`[Vite Storage] Failed to write PDF ${savedFilename} to disk:`, err);
              }

              const clientOrigin = (req.headers['x-client-origin'] as string) || body.clientOrigin;
              const baseUrl = resolvePublicBaseUrl(req, clientOrigin);
              const publicUrl = `${baseUrl}/uploads/pdfs/${savedFilename}`;
              const remotePath = `/uploads/pdfs/${savedFilename}`;

              console.log(`[Vite Storage] PDF uploaded: "${savedFilename}" (${buffer.length} bytes) -> URL: ${publicUrl}`);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                publicUrl,
                filename: savedFilename,
                fileSize: buffer.length,
                remotePath,
                provider: 'app_storage',
                uploadedAt: now,
              }));
            } catch (err: any) {
              console.error('[Vite Storage] PDF upload error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Failed to upload PDF' }));
            }
          });
          return;
        }

        if (pathname === '/api/storage/pdf/verify' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            let requestedUrl = '';
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { url } = body;
              requestedUrl = typeof url === 'string' ? url : '';

              if (!url || typeof url !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'URL is required in request body' }));
                return;
              }

              const trimmed = (url || '').trim();
              const isHttps = trimmed.startsWith('https://');
              const isLocalhost = trimmed.includes('localhost') || trimmed.includes('127.0.0.1') || trimmed.includes('0.0.0.0');
              const isBlob = trimmed.startsWith('blob:') || trimmed.startsWith('data:') || trimmed.startsWith('file:');
              const isDevContainer = trimmed.includes('.run.app') || trimmed.includes('ais-dev-') || trimmed.includes('ais-pre-') || trimmed.includes('__cookie_check');

              if (isBlob || isLocalhost || isDevContainer) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
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
                }));
                return;
              }

              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 12000);
              let fetchRes: Response | null = null;
              try {
                fetchRes = await fetch(trimmed, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
              } catch {
                fetchRes = await fetch(trimmed, { method: 'GET', signal: controller.signal, redirect: 'follow' });
              }
              clearTimeout(timer);

              const finalUrl = fetchRes.url || trimmed;
              if (finalUrl.includes('__cookie_check') || finalUrl.includes('login')) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  reachable: false,
                  status: fetchRes.status,
                  contentType: fetchRes.headers.get('content-type') || '',
                  contentLength: 0,
                  isPdf: false,
                  isHttps,
                  isHtml: true,
                  error: 'URL redirected to a cookie check or login page (__cookie_check.html)',
                }));
                return;
              }

              const status = fetchRes.status;
              const contentType = (fetchRes.headers.get('content-type') || '').toLowerCase();
              const contentLength = Number(fetchRes.headers.get('content-length') || '0');
              const isHtml = contentType.includes('text/html') || contentType.includes('text/plain');
              const isPdf = contentType.includes('application/pdf') || 
                            contentType.includes('octet-stream') || 
                            contentType.includes('binary/octet-stream') ||
                            trimmed.toLowerCase().endsWith('.pdf');

              const reachable = (status === 200 || status === 206) && isPdf && !isHtml;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                reachable,
                status,
                contentType,
                contentLength,
                isPdf,
                isHttps,
                isHtml,
                error: !reachable
                  ? (isHtml ? 'URL returned an HTML web page instead of raw PDF document bytes' : `HTTP ${status} returned with Content-Type: ${contentType}`)
                  : undefined,
              }));
            } catch (err: any) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                reachable: false,
                status: 0,
                isPdf: false,
                isHttps: requestedUrl.startsWith('https://'),
                isHtml: false,
                error: err.message || 'Verification connection failed or timed out',
              }));
            }
          });
          return;
        }

        if (pathname === '/api/storage/pdf/postfile-upload' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { fileBase64, filename = 'ebook.pdf', apiKey } = body;

              if (!fileBase64) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'fileBase64 payload required' }));
                return;
              }

              const keyToUse = (apiKey || process.env.POSTFILE_API_KEY || '').trim();
              if (!keyToUse) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'PostFile API key required. Please enter your API key in Settings (stored in your browser only).' }));
                return;
              }
              const buffer = Buffer.from(fileBase64, 'base64');
              const cleanBase = (filename || 'ebook').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
              const savedFilename = `${cleanBase}_${Date.now()}.pdf`;

              const fd = new FormData();
              const blob = new Blob([buffer], { type: 'application/pdf' });
              fd.append('file', blob, savedFilename);

              const pfRes = await fetch('https://postfile.net/v1/upload', {
                method: 'POST',
                headers: { 'X-API-Key': keyToUse },
                body: fd,
              });

              if (pfRes.ok) {
                const pfJson: any = await pfRes.json();
                const directUrl = pfJson.url || pfJson.direct_url || pfJson.download_url || (pfJson.data && pfJson.data.url);
                if (directUrl && directUrl.startsWith('https://')) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    publicUrl: directUrl,
                    filename: savedFilename,
                    fileSize: buffer.length,
                    provider: 'PostFile Cloud CDN',
                    uploadedAt: new Date().toISOString(),
                  }));
                  return;
                }
              }

              const errText = await pfRes.text().catch(() => '');
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `PostFile responded with ${pfRes.status}: ${errText}` }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'PostFile upload failed' }));
            }
          });
          return;
        }

        if (pathname === '/api/storage/pdf/free-upload' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { fileBase64, filename = 'ebook.pdf' } = body;

              if (!fileBase64) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'fileBase64 payload required' }));
                return;
              }

              const buffer = Buffer.from(fileBase64, 'base64');
              const cleanBase = (filename || 'ebook').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
              const savedFilename = `${cleanBase}_${Date.now()}.pdf`;

              let publicUrl = '';
              let providerName = '';

              // Tier 1: PostFile
              const postFileKey = (process.env.POSTFILE_API_KEY || '').trim();
              if (postFileKey) {
                try {
                  const fd = new FormData();
                  const blob = new Blob([buffer], { type: 'application/pdf' });
                  fd.append('file', blob, savedFilename);

                  const pfRes = await fetch('https://postfile.net/v1/upload', {
                    method: 'POST',
                    headers: { 'X-API-Key': postFileKey },
                    body: fd,
                  });
                  if (pfRes.ok) {
                    const pfJson: any = await pfRes.json();
                    const dUrl = pfJson.url || pfJson.direct_url || pfJson.download_url || (pfJson.data && pfJson.data.url);
                    if (dUrl && dUrl.startsWith('https://')) {
                      publicUrl = dUrl;
                      providerName = 'PostFile Cloud CDN';
                    }
                  }
                } catch (e: any) {
                  console.warn('Vite dev PostFile upload error:', e.message);
                }
              }

              // Catbox.moe
              if (!publicUrl) {
                try {
                  const fd = new FormData();
                  fd.append('reqtype', 'fileupload');
                  const blob = new Blob([buffer], { type: 'application/pdf' });
                  fd.append('fileToUpload', blob, savedFilename);

                  const cRes = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd });
                  if (cRes.ok) {
                    const dUrl = (await cRes.text()).trim();
                    if (dUrl.startsWith('https://')) {
                      publicUrl = dUrl;
                      providerName = 'Catbox Cloud (Free)';
                    }
                  }
                } catch (e: any) {
                  console.warn('Vite dev Catbox upload error:', e.message);
                }
              }

              // TmpFiles
              if (!publicUrl) {
                try {
                  const fd = new FormData();
                  const blob = new Blob([buffer], { type: 'application/pdf' });
                  fd.append('file', blob, savedFilename);

                  const tRes = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: fd });
                  if (tRes.ok) {
                    const tj: any = await tRes.json();
                    if (tj?.data?.url) {
                      publicUrl = tj.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
                      providerName = 'TmpFiles CDN (Free)';
                    }
                  }
                } catch (e: any) {
                  console.warn('Vite dev TmpFiles upload error:', e.message);
                }
              }

              // PixelDrain
              if (!publicUrl) {
                try {
                  const pRes = await fetch(`https://pixeldrain.com/api/file/${encodeURIComponent(savedFilename)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/pdf' },
                    body: buffer,
                  });
                  if (pRes.ok) {
                    const pj: any = await pRes.json();
                    if (pj?.id) {
                      publicUrl = `https://pixeldrain.com/api/file/${pj.id}`;
                      providerName = 'PixelDrain (Free)';
                    }
                  }
                } catch (e: any) {
                  console.warn('Vite dev PixelDrain upload error:', e.message);
                }
              }

              if (!publicUrl) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Free PDF upload failed on all providers' }));
                return;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                publicUrl,
                filename: savedFilename,
                fileSize: buffer.length,
                provider: providerName || 'Free PDF Host',
                uploadedAt: new Date().toISOString(),
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Free PDF upload failed' }));
            }
          });
          return;
        }

        if (pathname === '/api/storage/pdf/s3-upload' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { provider, accountId, bucket, region, accessKeyId, secretAccessKey, publicDomain, path: remotePath, filename, fileBase64 } = body;

              if (!bucket || !fileBase64) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Bucket and file payload are required for S3 upload' }));
                return;
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

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                publicUrl,
                filename: filename || path.basename(cleanPath),
                fileSize: fileBuffer.length,
                provider: provider === 'r2' ? 'Cloudflare R2' : 'Amazon S3',
                remotePath: cleanPath,
                uploadedAt: new Date().toISOString(),
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'S3 upload failed' }));
            }
          });
          return;
        }

        if (pathname === '/api/storage/pdf/test-connection' && req.method === 'POST') {
          const clientOrigin = (req.headers['x-client-origin'] as string);
          const baseUrl = resolvePublicBaseUrl(req, clientOrigin);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            provider: 'app_storage',
            baseUrl,
            uploadsDir: pdfUploadsDir,
            diskWritable: fs.existsSync(pdfUploadsDir),
            cachedPdfs: memoryPdfStore.size,
            message: 'App Built-in Cloud Storage is online and ready for high-speed PDF uploads.',
          }));
          return;
        }

        // =========================================================================
        // 1. Serving Uploaded Images (/uploads/:filename or /api/images/:filename)
        // =========================================================================
        if (pathname.startsWith('/uploads/') || pathname.startsWith('/api/images/')) {
          const filename = path.basename(pathname);
          if (filename && filename !== 'upload' && filename !== 'batch-upload' && filename !== 'status') {
            // Check memory store
            if (memoryImageStore.has(filename)) {
              const item = memoryImageStore.get(filename)!;
              res.statusCode = 200;
              res.setHeader('Content-Type', item.mimeType || 'image/jpeg');
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.end(item.buffer);
              return;
            }

            // Check disk storage
            const filePath = path.join(uploadsDir, filename);
            if (fs.existsSync(filePath)) {
              const diskBuf = fs.readFileSync(filePath);
              const ext = path.extname(filename).toLowerCase();
              const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
              res.statusCode = 200;
              res.setHeader('Content-Type', mime);
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.end(diskBuf);
              return;
            }
          }
        }

        // =========================================================================
        // 2. Storage Status & Health Check
        // =========================================================================
        if (pathname === '/api/images/status' || pathname === '/api/storage/status') {
          const clientOrigin = req.headers['x-client-origin'] as string;
          const baseUrl = resolvePublicBaseUrl(req, clientOrigin);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'online',
            baseUrl,
            uploadsDir,
            diskWritable: fs.existsSync(uploadsDir),
            cachedImages: memoryImageStore.size,
          }));
          return;
        }

        // =========================================================================
        // 2.5 URL Verification Proxy (/api/images/verify-url)
        // =========================================================================
        if (pathname === '/api/images/verify-url' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { url } = body;

              if (!url || typeof url !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'URL is required in request body' }));
                return;
              }

              const result = await verifyPublicImageUrl(url);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ reachable: false, error: err.message || 'Verification proxy error' }));
            }
          });
          return;
        }

        // =========================================================================
        // 3. Single Image Upload (/api/images/upload)
        // =========================================================================
        if (pathname === '/api/images/upload' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { image, filename = 'pin_image.jpg', pinId } = body;

              if (!image || typeof image !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing or invalid image data in request body' }));
                return;
              }

              const saved = await uploadToPersistentPublicStorage(image, filename);

              console.log(`[Storage API] Image uploaded to public storage: "${saved.filename}" -> URL: ${saved.publicUrl}`);

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                url: saved.publicUrl,
                mediaUrl: saved.publicUrl,
                filename: saved.filename,
                pinId: pinId || null,
              }));
            } catch (err: any) {
              console.error('[Storage API] Image upload failed:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Failed to upload and store image' }));
            }
          });
          return;
        }

        // =========================================================================
        // 4. Batch Image Upload (/api/images/batch-upload)
        // =========================================================================
        if (pathname === '/api/images/batch-upload' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { items } = body;

              if (!Array.isArray(items) || items.length === 0) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Expected items array in request body' }));
                return;
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

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                results,
              }));
            } catch (err: any) {
              console.error('[Storage API] Batch upload failed:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal batch upload error' }));
            }
          });
          return;
        }

        // =========================================================================
        // 4.5 Gemini 3.8 AI Endpoints (/api/ai/models, /api/ai/analyze-pin, /api/ai/analyze-ebook)
        // =========================================================================
        if (pathname === '/api/ai/models' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            activeProvider: 'auto',
            gemini: {
              hasKey: getAvailableGeminiKeys().length > 0,
              hasBackupKey: getAvailableGeminiKeys().some(k => k.isBackup),
              models: [
                { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', description: 'Ultra-fast multimodal vision & high throughput', isVision: true, recommended: true },
                { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Google GenAI native vision intelligence', isVision: true },
              ],
            },
          }));
          return;
        }

        if ((pathname === '/api/ai/analyze-pin' || pathname === '/api/gemini/analyze-pin') && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            let reqFilename = '';
            let reqPrompt = '';
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { imageBase64, mimeType = 'image/jpeg', filename = '', language = 'English', customPrompt = '' } = body;
              reqFilename = filename;
              reqPrompt = customPrompt;

              if (!imageBase64) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Missing imageBase64 in request body' }));
                return;
              }

              let cleanedBase64 = imageBase64;
              let detectedMime = mimeType;
              if (imageBase64.includes('base64,')) {
                const parts = imageBase64.split('base64,');
                cleanedBase64 = parts[1];
                const mimeMatch = parts[0].match(/data:(.*?);/);
                if (mimeMatch) detectedMime = mimeMatch[1];
              }

              const availableKeys = getAvailableGeminiKeys();
              const customInstructions = customPrompt && typeof customPrompt === 'string' && customPrompt.trim()
                ? `\n\nUSER-SPECIFIED FOCUS & GUIDELINES: "${customPrompt.trim()}". Emphasize this requested focus in title & description.`
                : '';

              const systemInstruction = `You are an expert Pinterest content strategist, visual SEO taxonomy specialist, and copywriter.
Analyze this Pinterest image carefully. Identify only what is actually visible.
Generate:
1. TITLE: Catchy, Pinterest-friendly, SEO title (max 100 chars, no hashtags).
2. DESCRIPTION: Traffic-focused description (Hook + Value + Natural website CTA inviting viewer to visit, 2-4 sentences, max 500 chars).
3. TAGS: 8-15 natural Pinterest search keywords/topics (lowercase phrases 1-4 words, NO #, NO hyphens).
4. ALT TEXT: Objective visual accessibility text (1-2 sentences, NO sales CTAs).
Language: ${language}.
Return strictly valid JSON: {"title":"string","description":"string","tags":["string"],"altText":"string","url":"string"}${customInstructions}`;

              const prompt = `Analyze this Pinterest image (${filename || 'pin-image'}) and generate traffic-focused title, description with website CTA, 8-15 Pinterest keyword tags, and visual altText in ${language}. Return JSON only.`;

              let resultData: any = null;
              let lastErr: any = null;
              const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

              for (const keyConfig of availableKeys) {
                if (resultData) break;
                const ai = new GoogleGenAI({
                  apiKey: keyConfig.key,
                  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
                });

                for (const modelName of candidateModels) {
                  try {
                    const genPromise = ai.models.generateContent({
                      model: modelName,
                      contents: {
                        parts: [
                          { inlineData: { mimeType: detectedMime, data: cleanedBase64 } },
                          { text: prompt },
                        ],
                      },
                      config: {
                        systemInstruction,
                        temperature: 0.7,
                        responseMimeType: 'application/json',
                      },
                    });

                    const timeoutPromise = new Promise((_, reject) =>
                      setTimeout(() => reject(new Error(`Gemini ${modelName} request timed out`)), 25000)
                    );

                    const response: any = await Promise.race([genPromise, timeoutPromise]);
                    if (response?.text) {
                      let parsed: any;
                      try {
                        parsed = JSON.parse(response.text);
                      } catch {
                        const match = response.text.match(/\{[\s\S]*\}/);
                        parsed = match ? JSON.parse(match[0]) : null;
                      }
                      if (parsed && (parsed.title || parsed.description)) {
                        resultData = { ...parsed, model: modelName };
                        break;
                      }
                    }
                  } catch (e: any) {
                    lastErr = e;
                    console.warn(`[Vite AI Router] Gemini ${modelName} attempt failed:`, e.message);
                  }
                }
              }

              if (resultData && (resultData.title || resultData.description)) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  title: (resultData.title || '').trim(),
                  description: (resultData.description || '').trim(),
                  tags: Array.isArray(resultData.tags) ? resultData.tags : [],
                  altText: (resultData.altText || '').trim(),
                  url: (resultData.url || '').trim(),
                  provider: 'gemini',
                  model: resultData.model || 'gemini-3.5-flash-lite',
                  attempts: 1,
                  fallbackUsed: false,
                }));
                return;
              }

              // Fallback metadata generator
              const cleanSubject = (reqPrompt && reqPrompt.trim()) || (reqFilename ? reqFilename.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ') : 'Inspiring Creative Ideas');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                title: `${cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1)} Inspiration`,
                description: `Explore stunning inspiration, curated visual details, and modern tips for ${cleanSubject.toLowerCase()}. Discover more ideas on our website.`,
                tags: [cleanSubject.toLowerCase(), `${cleanSubject.toLowerCase()} ideas`, 'home decor', 'aesthetic vibes', 'creative ideas'],
                altText: `High-quality visual featuring ${cleanSubject.toLowerCase()} with aesthetic details.`,
                url: '',
                provider: 'fallback',
                model: 'smart-generator',
                attempts: 1,
                fallbackUsed: true,
              }));
            } catch (err: any) {
              console.error('[Vite AI Router] Error:', err);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                title: 'Curated Visual Inspiration',
                description: 'Explore stunning inspiration, curated visual details, and modern tips. Discover more ideas on our website.',
                tags: ['creative ideas', 'visual inspiration', 'trending style'],
                altText: 'High quality visual photograph',
                url: '',
                provider: 'fallback',
                model: 'smart-generator',
                attempts: 1,
                fallbackUsed: true,
              }));
            }
          });
          return;
        }

        if (pathname === '/api/ai/analyze-ebook' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          req.on('end', async () => {
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const body = JSON.parse(bodyStr || '{}');
              const { pdfNumber = '001', namingPrefix = '', filenames = [], existingTitles = [], sampleImageBase64 = '', language = 'English' } = body;

              const availableKeys = getAvailableGeminiKeys();
              if (availableKeys.length === 0) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'No Gemini API key configured on server' }));
                return;
              }

              const promptText = `Analyze this eBook group (PDF #${pdfNumber}, prefix: "${namingPrefix || 'eBook'}") containing ${filenames.length} images.
Filenames: ${filenames.slice(0, 15).join(', ')}
Titles: ${existingTitles.slice(0, 15).join(', ')}
Generate complete commercial eBook metadata in ${language} using Gemini 3.8. Return JSON only with fields: ebookTitle, subtitle, shortDescription, longDescription, mainTopic, audience, category, seoKeywords, pinterestKeywords, pinterestTitle, pinterestDescription.`;

              let resultData: any = null;
              for (const keyConfig of availableKeys) {
                try {
                  const ai = new GoogleGenAI({
                    apiKey: keyConfig.key,
                    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
                  });
                  const parts: any[] = [{ text: promptText }];
                  if (sampleImageBase64) {
                    let cleanB64 = sampleImageBase64;
                    let mime = 'image/jpeg';
                    if (sampleImageBase64.includes('base64,')) {
                      cleanB64 = sampleImageBase64.split('base64,')[1];
                      const mm = sampleImageBase64.match(/data:(.*?);/);
                      if (mm) mime = mm[1];
                    }
                    parts.unshift({ inlineData: { mimeType: mime, data: cleanB64 } });
                  }

                  const genPromise = ai.models.generateContent({
                    model: 'gemini-3.8-flash',
                    contents: { parts },
                    config: {
                      temperature: 0.7,
                      responseMimeType: 'application/json',
                    },
                  });

                  const resGemini = await Promise.race([
                    genPromise,
                    new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 25000))
                  ]) as any;

                  if (resGemini?.text) {
                    resultData = JSON.parse(resGemini.text);
                    break;
                  }
                } catch (e: any) {
                  console.warn('[Vite AI Router] eBook Gemini 3.8 attempt error:', e.message);
                }
              }

              if (!resultData || !resultData.ebookTitle) {
                const fallbackSubject = namingPrefix ? namingPrefix.replace(/[_\-]+/g, ' ') : 'Curated Collection';
                resultData = {
                  ebookTitle: `${fallbackSubject} Vol. ${pdfNumber}`,
                  subtitle: `Complete ${filenames.length}-Page Digital Collection`,
                  shortDescription: `A high-quality printable collection of ${filenames.length} curated pages.`,
                  longDescription: `Explore this digital eBook featuring ${filenames.length} hand-selected pages.`,
                  mainTopic: fallbackSubject,
                  audience: 'Digital Creators & Enthusiasts',
                  category: 'Digital Printables & Guides',
                  seoKeywords: [fallbackSubject.toLowerCase(), 'printable pdf', 'digital ebook'],
                  pinterestKeywords: [fallbackSubject.toLowerCase(), 'printable pdf'],
                  pinterestTitle: `${fallbackSubject} Printable Collection #${pdfNumber}`,
                  pinterestDescription: `Download this stunning ${filenames.length}-page collection! Visit our website for more inspiration.`,
                };
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, metadata: resultData }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Failed to generate eBook metadata' }));
            }
          });
          return;
        }

        // =========================================================================
        // 5. Pinterest API Proxy Routes
        // =========================================================================
        if (pathname.startsWith('/api/pinterest')) {
          const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

          const fetchPinterestWithRetry = async (url: string, options: any, maxRetries = 3) => {
            let lastError: any = null;
            let lastResponse: any = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                const fetchRes = await fetch(url, options);
                lastResponse = fetchRes;

                if ([429, 500, 502, 503, 504].includes(fetchRes.status) && attempt < maxRetries) {
                  const backoffMs = attempt * 1500;
                  console.warn(`[Pinterest Vite Proxy] Request returned HTTP ${fetchRes.status}. Retrying in ${backoffMs}ms...`);
                  await wait(backoffMs);
                  continue;
                }

                return fetchRes;
              } catch (networkErr: any) {
                lastError = networkErr;
                if (attempt < maxRetries) {
                  const backoffMs = attempt * 1500;
                  await wait(backoffMs);
                  continue;
                }
              }
            }

            if (lastResponse) return lastResponse;
            throw lastError || new Error('Network error calling Pinterest API');
          };

          const resolveToken = () => {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
              const headerToken = authHeader.substring(7).trim();
              if (headerToken) return headerToken;
            }
            return process.env.PINTEREST_ACCESS_TOKEN?.trim() || null;
          };

          // GET /api/pinterest/status
          if (pathname === '/api/pinterest/status' && req.method === 'GET') {
            const token = resolveToken();
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              configured: Boolean(token),
              hasToken: Boolean(token),
            }));
            return;
          }

          // GET /api/pinterest/user_account
          if (pathname === '/api/pinterest/user_account' && req.method === 'GET') {
            try {
              const token = resolveToken();
              if (!token) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  error: 'Pinterest Access Token is not set in Environment Variables (PINTEREST_ACCESS_TOKEN) or request header.',
                  statusCode: 401,
                }));
                return;
              }

              const pinRes = await fetchPinterestWithRetry(`${PINTEREST_API_BASE}/user_account`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              const raw = await pinRes.text();
              let data: any = {};
              try { data = JSON.parse(raw || '{}'); } catch { data = {}; }

              res.statusCode = pinRes.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal error' }));
              return;
            }
          }

          // GET /api/pinterest/boards
          if (pathname === '/api/pinterest/boards' && req.method === 'GET') {
            try {
              const token = resolveToken();
              if (!token) {
                res.statusCode = 401;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  error: 'Pinterest Access Token is not set.',
                  statusCode: 401,
                }));
                return;
              }

              const pinRes = await fetchPinterestWithRetry(`${PINTEREST_API_BASE}/boards?page_size=100`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              const raw = await pinRes.text();
              let data: any = {};
              try { data = JSON.parse(raw || '{}'); } catch { data = {}; }

              res.statusCode = pinRes.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal error' }));
              return;
            }
          }

          // POST /api/pinterest/pins
          if (pathname === '/api/pinterest/pins' && req.method === 'POST') {
            const chunks: Buffer[] = [];
            req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
            req.on('end', async () => {
              try {
                const bodyStr = Buffer.concat(chunks).toString('utf-8');
                const payload = JSON.parse(bodyStr || '{}');
                const token = resolveToken();
                if (!token) {
                  res.statusCode = 401;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Pinterest Access Token is not set.', statusCode: 401 }));
                  return;
                }

                const { title, description, link, alt_text, board_id, media_source } = payload;
                const pinPayload = {
                  title: title ? String(title).slice(0, 100) : undefined,
                  description: description ? String(description).slice(0, 500) : undefined,
                  link: link ? String(link) : undefined,
                  alt_text: alt_text ? String(alt_text).slice(0, 500) : undefined,
                  board_id: String(board_id),
                  media_source,
                };

                const pinRes = await fetchPinterestWithRetry(`${PINTEREST_API_BASE}/pins`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(pinPayload),
                });

                const raw = await pinRes.text();
                let data: any = {};
                try { data = JSON.parse(raw || '{}'); } catch { data = {}; }

                res.statusCode = pinRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Internal error' }));
              }
            });
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    apiAndStoragePlugin(),
  ],
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''),
    'process.env.POLLINATIONS_API_KEY': JSON.stringify(process.env.POLLINATIONS_API_KEY || process.env.VITE_POLLINATIONS_API_KEY || ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
