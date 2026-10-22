import { Pin, Board } from '../types';

export interface UtmConfig {
  source: string; // e.g. "pinterest"
  medium: string; // e.g. "social", "pin", "bulk_publish"
  campaign?: string; // e.g. "fall_collection" or "{board}"
  content?: string; // e.g. "{title}"
  term?: string; // keywords
}

export function buildUtmUrl(baseUrl: string, config: UtmConfig, pin?: Pin, board?: Board): string {
  if (!baseUrl || !baseUrl.trim()) return '';

  let normalized = baseUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);

    if (config.source) {
      url.searchParams.set('utm_source', config.source);
    }
    if (config.medium) {
      url.searchParams.set('utm_medium', config.medium);
    }

    if (config.campaign) {
      let camp = config.campaign;
      if (board && camp.includes('{board}')) {
        camp = camp.replace('{board}', board.name.toLowerCase().replace(/[^a-z0-9]/g, '_'));
      }
      url.searchParams.set('utm_campaign', camp);
    }

    if (config.content) {
      let cnt = config.content;
      if (pin && cnt.includes('{title}')) {
        cnt = cnt.replace('{title}', pin.title.toLowerCase().substring(0, 30).replace(/[^a-z0-9]/g, '_'));
      }
      url.searchParams.set('utm_content', cnt);
    }

    if (config.term) {
      url.searchParams.set('utm_term', config.term);
    }

    return url.toString();
  } catch {
    return baseUrl;
  }
}
