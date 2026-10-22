import { Pin, Board, PinterestAccount } from '../types';
import { formatPinterestDescription } from './tagsHelper';

export interface PinterestBoardResponse {
  items: Array<{
    id: string;
    name: string;
    description?: string;
    pin_count?: number;
    privacy?: 'PUBLIC' | 'SECRET';
  }>;
}

export interface PinterestUserResponse {
  id: string;
  username: string;
  profile_image?: string;
  account_type?: string;
  website_url?: string;
  business_name?: string;
  pin_count?: number;
  board_count?: number;
}

export interface PinterestPinCreationResponse {
  id: string;
  title: string;
  description: string;
  link?: string;
  board_id: string;
  created_at: string;
  media?: any;
}

export class PinterestApiError extends Error {
  statusCode?: number;
  code?: number;
  details?: any;
  constructor(message: string, statusCode?: number, code?: number, details?: any) {
    super(message);
    this.name = 'PinterestApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Safe fetch helper that reads response text first, checks Content-Type,
 * and handles HTML / non-JSON responses without JSON.parse crashing.
 */
async function safeFetchPinterestJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();

    const isHtml = 
      rawText.trim().toLowerCase().startsWith('<!doctype html') ||
      rawText.trim().toLowerCase().startsWith('<html') ||
      contentType.includes('text/html');

    if (isHtml) {
      console.error(`[Pinterest API] Request to ${url} returned HTML (Status: ${res.status}, Content-Type: ${contentType})`);
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Pinterest API returned HTML instead of JSON (HTTP ${res.status}). Check server endpoint configuration.`,
      };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText || '{}');
    } catch {
      console.error(`[Pinterest API] Failed to parse JSON response from ${url} (Status: ${res.status})`);
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Invalid JSON returned by Pinterest endpoint (HTTP ${res.status})`,
      };
    }

    if (!res.ok) {
      if (res.status === 401) {
        return {
          ok: false,
          status: 401,
          data: parsed,
          error: 'Pinterest authentication expired. Please reconnect Pinterest.',
        };
      }
      if (res.status === 403) {
        return {
          ok: false,
          status: 403,
          data: parsed,
          error: parsed.error || parsed.message || 'Pinterest permission denied. Please check your Pinterest token scopes (user_accounts:read, boards:read, pins:read, pins:write).',
        };
      }
      return {
        ok: false,
        status: res.status,
        data: parsed,
        error: parsed.error || parsed.message || parsed.details?.[0]?.message || `Pinterest API Error (HTTP ${res.status})`,
      };
    }

    return {
      ok: true,
      status: res.status,
      data: parsed,
    };
  } catch (err: any) {
    console.error(`[Pinterest API] Network / connection error calling ${url}:`, err.message);
    return {
      ok: false,
      status: 0,
      data: null,
      error: err.message || 'Network error connecting to Pinterest service',
    };
  }
}

export const pinterestService = {
  /**
   * Check if PINTEREST_ACCESS_TOKEN is configured in environment
   */
  async checkConfigStatus(): Promise<{ configured: boolean; hasToken: boolean }> {
    try {
      const res = await fetch('/api/pinterest/status');
      if (res.ok) {
        const data = await res.json();
        return { configured: Boolean(data.configured), hasToken: Boolean(data.hasToken) };
      }
    } catch {
      // ignore
    }
    return { configured: false, hasToken: false };
  },

  /**
   * Stage 1: Test Connection & Fetch User Profile
   * Uses PINTEREST_ACCESS_TOKEN from environment (or optional Bearer token if provided)
   */
  async fetchUserProfile(optionalAccessToken?: string): Promise<PinterestAccount> {
    console.log('[Pinterest API] Testing connection: GET /api/pinterest/user_account');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (optionalAccessToken && optionalAccessToken.trim()) {
      headers['Authorization'] = `Bearer ${optionalAccessToken.trim()}`;
    }

    const { ok, status, data, error } = await safeFetchPinterestJson<PinterestUserResponse>(
      '/api/pinterest/user_account',
      { headers }
    );

    if (!ok || !data) {
      throw new PinterestApiError(
        error || `Failed to connect to Pinterest API (HTTP ${status})`,
        status
      );
    }

    console.log(`[Pinterest API] Pinterest Connected ✓ Account: @${data.username} (ID: ${data.id})`);

    return {
      id: 'pinterest_account',
      username: data.username || 'Pinterest User',
      accountId: data.id,
      avatarUrl: data.profile_image || null,
      accessToken: optionalAccessToken || 'configured_env_token',
      isConnected: true,
      connectedAt: new Date().toISOString(),
    };
  },

  /**
   * Stage 2: Fetch Boards from Pinterest Account
   */
  async fetchBoards(optionalAccessToken?: string): Promise<Board[]> {
    console.log('[Pinterest API] Fetching boards: GET /api/pinterest/boards');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (optionalAccessToken && optionalAccessToken.trim()) {
      headers['Authorization'] = `Bearer ${optionalAccessToken.trim()}`;
    }

    const { ok, status, data, error } = await safeFetchPinterestJson<PinterestBoardResponse>(
      '/api/pinterest/boards',
      { headers }
    );

    if (!ok || !data) {
      throw new PinterestApiError(
        error || `Failed to fetch Pinterest boards (HTTP ${status})`,
        status
      );
    }

    const items = data.items || [];
    console.log(`[Pinterest API] Successfully fetched ${items.length} real Pinterest boards.`);

    return items.map(item => ({
      id: `board_pin_${item.id}`,
      name: item.name,
      pinterestBoardId: item.id,
      description: item.description || '',
      privacy: item.privacy || 'PUBLIC',
      pinCount: item.pin_count || 0,
      createdAt: new Date().toISOString(),
    }));
  },

  /**
   * Stage 3: Create Real Pin on Pinterest
   * POST /api/pinterest/pins -> POST https://api.pinterest.com/v5/pins
   */
  async createPin(
    pin: Pin,
    pinterestBoardId: string,
    optionalAccessToken?: string
  ): Promise<PinterestPinCreationResponse> {
    if (!pinterestBoardId) {
      throw new PinterestApiError('A valid Pinterest Board must be selected before publishing.', 400);
    }

    // Format Media Source for Pinterest API v5
    let mediaSource: any = {};
    if (pin.imageUrl.startsWith('data:')) {
      const commaIdx = pin.imageUrl.indexOf(',');
      const contentTypeMatch = pin.imageUrl.match(/^data:([^;]+);/);
      const contentType = contentTypeMatch ? contentTypeMatch[1] : 'image/jpeg';
      const base64Data = pin.imageUrl.substring(commaIdx + 1);

      mediaSource = {
        source_type: 'image_base64',
        content_type: contentType,
        data: base64Data,
      };
    } else if (pin.imageUrl.startsWith('http')) {
      mediaSource = {
        source_type: 'image_url',
        url: pin.imageUrl,
      };
    } else {
      throw new PinterestApiError('Pin image has invalid format or is missing.', 400);
    }

    // Build Pinterest Description with Tags naturally included in clean #hashtag format
    const formattedDescription = formatPinterestDescription(pin.description, pin.tags);

    const payload = {
      title: pin.title || pin.filename,
      description: formattedDescription,
      link: pin.destinationUrl || undefined,
      alt_text: pin.altText || pin.title || undefined,
      board_id: pinterestBoardId,
      media_source: mediaSource,
    };

    console.log(`[Pinterest API] Publishing Pin "${pin.title || pin.filename}" to Board ${pinterestBoardId}...`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (optionalAccessToken && optionalAccessToken.trim() && optionalAccessToken !== 'configured_env_token') {
      headers['Authorization'] = `Bearer ${optionalAccessToken.trim()}`;
    }

    const { ok, status, data, error } = await safeFetchPinterestJson<PinterestPinCreationResponse>(
      '/api/pinterest/pins',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }
    );

    if (!ok || !data || !data.id) {
      console.error(`[Pinterest API] Failed to create Pin: ${error} (HTTP ${status})`);
      throw new PinterestApiError(
        error || `Pinterest Pin creation failed (HTTP ${status})`,
        status
      );
    }

    console.log(`[Pinterest API] Published ✓ Real Pin ID: ${data.id}`);
    return data;
  },
};

export const pinterestApi = {
  ...pinterestService,
  fetchUserAccount: (token?: string) => pinterestService.fetchUserProfile(token),
};
