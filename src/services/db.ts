import { Pin, Website, Board, PinterestAccount, AppSettings } from '../types';

const DB_NAME = 'pinpulse_db';
const DB_VERSION = 1;

const STORES = {
  PINS: 'pins',
  BOARDS: 'boards',
  WEBSITES: 'websites',
  ACCOUNT: 'account',
  SETTINGS: 'settings',
};

// Initial starter boards and websites
const DEFAULT_BOARDS: Board[] = [
  { id: 'board-1', name: 'Back to School 2026', pinterestBoardId: 'pb-101', description: 'School supplies, lunch ideas, outfit inspiration', createdAt: new Date().toISOString() },
  { id: 'board-2', name: 'Home Decor & DIY', pinterestBoardId: 'pb-102', description: 'Cozy interiors and aesthetic room decor', createdAt: new Date().toISOString() },
  { id: 'board-3', name: 'Healthy Recipes & Meal Prep', pinterestBoardId: 'pb-103', description: 'Quick 15-minute high protein dinners', createdAt: new Date().toISOString() },
  { id: 'board-4', name: 'Digital Marketing & Growth', pinterestBoardId: 'pb-104', description: 'Pinterest SEO, blog traffic, and affiliate tips', createdAt: new Date().toISOString() },
];

const DEFAULT_WEBSITES: Website[] = [
  { id: 'web-1', name: 'Main Lifestyle Blog', url: 'https://mysimplelivingblog.com', createdAt: new Date().toISOString() },
  { id: 'web-2', name: 'Etsy Printables Store', url: 'https://etsy.com/shop/aestheticstudio', createdAt: new Date().toISOString() },
  { id: 'web-3', name: 'Recipe Corner', url: 'https://yummymealsdaily.com', createdAt: new Date().toISOString() },
];

const DEFAULT_SETTINGS: AppSettings = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  defaultBoardId: 'board-1',
  defaultWebsiteId: 'web-1',
  defaultPublishingTimes: ['09:00', '13:30', '18:00', '21:00'],
  pinterestClientId: '',
  pinterestClientSecret: '',
  pinterestAccessToken: '',
  autoScheduleIntervalDays: 7,
  aiProvider: 'groq',
  groqApiKey: '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',
  groqModel: 'openai/gpt-oss-120b',
  openrouterApiKey: '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',
  openrouterModel: 'openrouter/auto',
  customApiUrl: '',
  customApiKey: '',
  customApiModel: '',
  autoRetry: true,
  maxRetries: 3,
  retryDelay: 2000,
  timeout: 15000,
  aiModel: 'gemini-3.5-flash-lite',
  aiLanguage: 'English',
  autoStartAiOnUpload: true,
  aiMinDelaySeconds: 15,
  aiMaxDelaySeconds: 30,
};

// Open IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.PINS)) {
        const pinStore = db.createObjectStore(STORES.PINS, { keyPath: 'id' });
        pinStore.createIndex('status', 'status', { unique: false });
        pinStore.createIndex('aiStatus', 'aiStatus', { unique: false });
        pinStore.createIndex('boardId', 'boardId', { unique: false });
        pinStore.createIndex('scheduledAt', 'scheduledAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.BOARDS)) {
        db.createObjectStore(STORES.BOARDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.WEBSITES)) {
        db.createObjectStore(STORES.WEBSITES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ACCOUNT)) {
        db.createObjectStore(STORES.ACCOUNT, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const dbService = {
  // PINS
  async getAllPins(): Promise<Pin[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PINS, 'readonly');
        const store = tx.objectStore(STORES.PINS);
        const req = store.getAll();
        req.onsuccess = () => {
          const pins = (req.result || []).map((p: any) => ({
            ...p,
            tags: Array.isArray(p.tags) ? p.tags : [],
            aiStatus: p.aiStatus || (p.aiGenerated ? 'completed' : 'pending'),
            aiGenerated: p.aiGenerated ?? false,
            titleManuallyEdited: p.titleManuallyEdited ?? false,
            descriptionManuallyEdited: p.descriptionManuallyEdited ?? false,
            tagsManuallyEdited: p.tagsManuallyEdited ?? false,
          }));
          resolve(pins);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      const fallback = localStorage.getItem('pinpulse_pins');
      return fallback ? JSON.parse(fallback) : [];
    }
  },

  async getPin(id: string): Promise<Pin | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PINS, 'readonly');
        const store = tx.objectStore(STORES.PINS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      const pins = await this.getAllPins();
      return pins.find(p => p.id === id) || null;
    }
  },

  async savePin(pin: Pin): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PINS, 'readwrite');
        const store = tx.objectStore(STORES.PINS);
        const req = store.put(pin);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      try {
        const pins = await this.getAllPins();
        const idx = pins.findIndex(p => p.id === pin.id);
        if (idx >= 0) pins[idx] = pin;
        else pins.unshift(pin);
        localStorage.setItem('pinpulse_pins', JSON.stringify(pins));
      } catch (err) {
        console.warn('localStorage savePin fallback skipped (storage limit reached):', err);
      }
    }
  },

  async savePins(pins: Pin[]): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PINS, 'readwrite');
        const store = tx.objectStore(STORES.PINS);
        pins.forEach(pin => store.put(pin));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try {
        localStorage.setItem('pinpulse_pins', JSON.stringify(pins));
      } catch (err) {
        console.warn('localStorage savePins fallback skipped (storage limit reached):', err);
      }
    }
  },

  async deletePin(id: string): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PINS, 'readwrite');
        const store = tx.objectStore(STORES.PINS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      const pins = (await this.getAllPins()).filter(p => p.id !== id);
      localStorage.setItem('pinpulse_pins', JSON.stringify(pins));
    }
  },

  async deletePins(ids: string[]): Promise<void> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PINS, 'readwrite');
        const store = tx.objectStore(STORES.PINS);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const set = new Set(ids);
      const pins = (await this.getAllPins()).filter(p => !set.has(p.id));
      localStorage.setItem('pinpulse_pins', JSON.stringify(pins));
    }
  },

  // BOARDS
  async getAllBoards(): Promise<Board[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.BOARDS, 'readonly');
        const store = tx.objectStore(STORES.BOARDS);
        const req = store.getAll();
        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            resolve(req.result);
          } else {
            // Seed default boards
            this.saveBoards(DEFAULT_BOARDS).then(() => resolve(DEFAULT_BOARDS));
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return DEFAULT_BOARDS;
    }
  },

  async saveBoard(board: Board): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BOARDS, 'readwrite');
      const store = tx.objectStore(STORES.BOARDS);
      const req = store.put(board);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async saveBoards(boards: Board[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BOARDS, 'readwrite');
      const store = tx.objectStore(STORES.BOARDS);
      boards.forEach(b => store.put(b));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteBoard(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.BOARDS, 'readwrite');
      const store = tx.objectStore(STORES.BOARDS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // WEBSITES
  async getAllWebsites(): Promise<Website[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.WEBSITES, 'readonly');
        const store = tx.objectStore(STORES.WEBSITES);
        const req = store.getAll();
        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            resolve(req.result);
          } else {
            this.saveWebsites(DEFAULT_WEBSITES).then(() => resolve(DEFAULT_WEBSITES));
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return DEFAULT_WEBSITES;
    }
  },

  async saveWebsite(website: Website): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WEBSITES, 'readwrite');
      const store = tx.objectStore(STORES.WEBSITES);
      const req = store.put(website);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async saveWebsites(websites: Website[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WEBSITES, 'readwrite');
      const store = tx.objectStore(STORES.WEBSITES);
      websites.forEach(w => store.put(w));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteWebsite(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WEBSITES, 'readwrite');
      const store = tx.objectStore(STORES.WEBSITES);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // ACCOUNT
  async getPinterestAccount(): Promise<PinterestAccount | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ACCOUNT, 'readonly');
        const store = tx.objectStore(STORES.ACCOUNT);
        const req = store.get('pinterest_account');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  },

  async savePinterestAccount(account: PinterestAccount | null): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.ACCOUNT, 'readwrite');
      const store = tx.objectStore(STORES.ACCOUNT);
      if (account) {
        store.put({ ...account, id: 'pinterest_account' });
      } else {
        store.delete('pinterest_account');
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // SETTINGS
  async getSettings(): Promise<AppSettings> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.SETTINGS, 'readonly');
        const store = tx.objectStore(STORES.SETTINGS);
        const req = store.get('app_settings');
        req.onsuccess = () => {
          if (!req.result) {
            resolve(DEFAULT_SETTINGS);
            return;
          }
          const loaded = { ...DEFAULT_SETTINGS, ...req.result };
          if (!loaded.aiModel || loaded.aiModel === 'gemini-3.7-flash' || loaded.aiModel === 'gemini-2.5-flash') {
            loaded.aiModel = 'gemini-3.8-flash';
          }
          resolve(loaded);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      store.put({ ...settings, id: 'app_settings' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
