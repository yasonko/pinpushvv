import { Pin, Website } from '../types';

export type UrlDistributionMode = 
  | 'single' 
  | 'round_robin' 
  | 'random' 
  | 'split_custom';

/**
 * Distributes website URLs across a list of Pins based on the chosen mode.
 * - 'round_robin': Cycles through the website URLs evenly across all pins.
 * - 'random': Assigns a random website URL to each pin.
 * - 'single': Assigns a single specified URL to all pins.
 */
export function distributeWebsiteUrlsToPins(
  pins: Pin[],
  websites: Website[],
  options: {
    mode: 'round_robin' | 'random' | 'single';
    customUrlList?: string[];
    singleUrl?: string;
    singleWebsiteId?: string;
  }
): Pin[] {
  if (pins.length === 0) return [];

  const now = new Date().toISOString();

  // If custom URL strings are provided (e.g., from split list textarea)
  const urlList: Array<{ url: string; websiteId?: string }> = [];

  if (options.customUrlList && options.customUrlList.length > 0) {
    options.customUrlList.forEach(rawUrl => {
      const trimmed = rawUrl.trim();
      if (!trimmed) return;
      let finalUrl = trimmed;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
      // Match websiteId if possible
      const matchedWeb = websites.find(w => finalUrl.startsWith(w.url) || w.url.startsWith(finalUrl));
      urlList.push({
        url: finalUrl,
        websiteId: matchedWeb?.id
      });
    });
  } else if (websites.length > 0) {
    websites.forEach(w => {
      urlList.push({
        url: w.url,
        websiteId: w.id
      });
    });
  }

  if (options.mode === 'single') {
    const targetUrl = options.singleUrl?.trim() || (websites[0]?.url ?? '');
    const matchedWeb = websites.find(w => w.id === options.singleWebsiteId) || websites.find(w => targetUrl.startsWith(w.url));
    
    return pins.map(pin => ({
      ...pin,
      destinationUrl: targetUrl,
      websiteId: matchedWeb?.id || pin.websiteId,
      updatedAt: now,
    }));
  }

  if (urlList.length === 0) {
    return pins;
  }

  return pins.map((pin, idx) => {
    let chosen: { url: string; websiteId?: string };

    if (options.mode === 'round_robin') {
      chosen = urlList[idx % urlList.length];
    } else {
      // random
      const randIdx = Math.floor(Math.random() * urlList.length);
      chosen = urlList[randIdx];
    }

    return {
      ...pin,
      destinationUrl: chosen.url,
      websiteId: chosen.websiteId || pin.websiteId,
      updatedAt: now,
    };
  });
}
