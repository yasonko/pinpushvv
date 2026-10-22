import { EbookBatch, EbookGroup, EbookImageItem, PdfSettings } from '../../types/ebook';

const STORAGE_KEY = 'pin_publisher_ebook_active_batch';
const DB_NAME = 'pinpulse_ebook_db';
const DB_VERSION = 1;
const STORE_NAME = 'ebook_batches';

function openEbookDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('hash', 'hash', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Computes a fast deterministic hash string for a batch
 */
export function computeBatchHash(images: EbookImageItem[], settings: PdfSettings): string {
  const fileSignatures = images
    .slice(0, 50)
    .map((img) => `${img.filename}:${img.size || 0}`)
    .join('|');
  const settingsSig = `${settings.imagesPerPdf}-${settings.pageSize}-${settings.namingPrefix}-${settings.startNumber}`;
  const raw = `${images.length}-${fileSignatures}-${settingsSig}`;

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `batch_${Math.abs(hash).toString(36)}_${images.length}`;
}

/**
 * Saves or updates a batch in IndexedDB and local storage cache
 */
export async function saveEbookBatch(batch: EbookBatch): Promise<void> {
  // Strip non-serializable properties (e.g. blobs, file pointers) for lightweight storage
  const serialized = {
    ...batch,
    updatedAt: new Date().toISOString(),
    images: batch.images.map((img) => ({
      ...img,
      file: undefined, // remove file handle for storage
    })),
    groups: batch.groups.map((g) => ({
      ...g,
      pdfBlob: undefined, // don't persist heavy binary blobs in metadata DB
      imageItems: g.imageItems.map((img) => ({
        ...img,
        file: undefined,
      })),
    })),
    zipBlob: undefined,
    excelBlob: undefined,
  };

  try {
    const db = await openEbookDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(serialized);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Ebook Batch Storage] IndexedDB save fallback to localStorage:', err);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // ignore
  }
}

/**
 * Loads the active or latest batch
 */
export async function getLastEbookBatch(): Promise<EbookBatch | null> {
  try {
    const db = await openEbookDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: EbookBatch[] = req.result || [];
        if (results.length > 0) {
          // Sort by updatedAt descending
          results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          resolve(results[0]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Finds if a matching batch already exists by computed hash
 */
export async function findBatchByHash(hash: string): Promise<EbookBatch | null> {
  try {
    const db = await openEbookDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('hash');
      const req = index.get(hash);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Clears active batch from cache
 */
export async function clearActiveEbookBatch(batchId?: string): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (batchId) {
      const db = await openEbookDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(batchId);
    }
  } catch {
    // ignore
  }
}
