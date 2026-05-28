// soul/helpers/spotifyClient.ts
//
// Tiny Spotify Web API wrapper using the Client Credentials flow. No npm
// package needed — Node 18+ has native `fetch`. Token is cached in-memory and
// refreshed only when expired.
//
// All methods here perform read-only public-data calls and need only the
// SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET env vars.
//
// Returns a discriminated `SpotifyResult<T>` shape from the public lookups so
// callers can distinguish "user not found" (404) from "Spotify Web API
// returned 403/401/429/network error" — the previous null-on-everything
// design was hiding important failure modes (notably the long-standing
// "Active premium subscription required for the owner of the app" 403 that
// affects dev apps whose owner isn't on Spotify Premium).

import config from '../config.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

let cached: CachedToken | null = null;

export function isSpotifyConfigured(): boolean {
  return !!(config.spotify.clientId && config.spotify.clientSecret);
}

// ── Result shape ──────────────────────────────────────────────────────────
export type SpotifyFailureKind =
  | 'notConfigured'
  | 'tokenFailure'
  | 'unauthorized'    // 401 — bad/expired token after refresh
  | 'forbidden'       // 403 — premium-required, geo-restricted, etc.
  | 'notFound'        // 404 — entity genuinely doesn't exist
  | 'rateLimited'     // 429
  | 'serverError'     // 5xx
  | 'networkError'    // fetch threw (DNS, ETIMEDOUT, etc.)
  | 'badResponse';    // 2xx but body shape was unexpected

export type SpotifyFailure = {
  ok: false;
  kind: SpotifyFailureKind;
  status?: number;
  message?: string;
};
export type SpotifySuccess<T> = { ok: true; data: T };
export type SpotifyResult<T> = SpotifySuccess<T> | SpotifyFailure;

/** Type guard — narrows to the failure branch even under `strict: false`. */
export function isSpotifyFailure<T>(r: SpotifyResult<T>): r is SpotifyFailure {
  return r.ok === false;
}

/** Human-friendly explanation of a Spotify failure kind. */
export function describeSpotifyFailure(result: SpotifyFailure): string {
  switch (result.kind) {
    case 'notConfigured':
      return 'Spotify integration is not configured on this bot. Please ask the developer.';
    case 'tokenFailure':
      return 'Couldn\'t authenticate with Spotify. The bot owner\'s Spotify app credentials may be invalid.';
    case 'unauthorized':
      return 'Spotify rejected the bot\'s credentials. The bot owner needs to check their Spotify app settings.';
    case 'forbidden': {
      const detail = result.message?.toLowerCase() ?? '';
      if (detail.includes('premium')) {
        return 'Spotify Web API access is blocked for this bot — the owner of the Spotify app needs an active Premium subscription. Please ask the developer.';
      }
      return `Spotify denied the request (403). ${result.message ?? ''}`.trim();
    }
    case 'notFound':
      return null as any; // caller decides the right "not found" message
    case 'rateLimited':
      return 'Spotify is rate-limiting the bot right now. Please try again in a moment.';
    case 'serverError':
      return 'Spotify\'s servers returned an error. Please try again in a moment.';
    case 'networkError':
      return 'Couldn\'t reach Spotify. The bot may be having network issues — please try again shortly.';
    case 'badResponse':
      return 'Spotify returned an unexpected response. Please try again or contact the developer.';
  }
}

// ── Token + low-level GET ─────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  if (!isSpotifyConfigured()) return null;
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const creds = Buffer.from(
    `${config.spotify.clientId}:${config.spotify.clientSecret}`,
  ).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  }).catch((): null => null);

  if (!res || !res.ok) return null;
  const data: any = await res.json().catch((): null => null);
  if (!data?.access_token) return null;

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

function statusToKind(status: number): SpotifyFailureKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 429) return 'rateLimited';
  if (status >= 500) return 'serverError';
  return 'badResponse';
}

async function spotifyGet<T = any>(path: string): Promise<SpotifyResult<T>> {
  if (!isSpotifyConfigured()) return { ok: false, kind: 'notConfigured' };
  const token = await getAccessToken();
  if (!token) return { ok: false, kind: 'tokenFailure' };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return { ok: false, kind: 'networkError', message: (err as Error).message };
  }

  if (!res.ok) {
    // Try to extract the human message Spotify returns in the error envelope.
    let message: string | undefined;
    try {
      const body: any = await res.json();
      message = body?.error?.message ?? body?.error_description;
    } catch {
      // Plain-text body; ignore.
    }
    return { ok: false, kind: statusToKind(res.status), status: res.status, message };
  }

  const data = (await res.json().catch((): null => null)) as T | null;
  if (data == null) return { ok: false, kind: 'badResponse' };
  return { ok: true, data };
}

// ── Parsers ───────────────────────────────────────────────────────────────

/**
 * Extract a Spotify user ID from either a raw ID
 * (`31fskpqyqxwqfovpzjmusztm3bg4`) or a profile URL
 * (`https://open.spotify.com/user/<id>` with optional query/locale path).
 * Returns null if the input doesn't look like a valid ID.
 */
export function parseSpotifyUserId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // URL form: capture the segment after `/user/`
  const urlMatch = trimmed.match(/open\.spotify\.com(?:\/[a-z-]+)?\/user\/([A-Za-z0-9._-]+)/i);
  if (urlMatch) return urlMatch[1];

  // Bare ID form — Spotify user IDs are alphanumerics, can include `_`, `.`, `-`
  if (/^[A-Za-z0-9._-]+$/.test(trimmed)) return trimmed;

  return null;
}

// ── Spotify URL parsing (track / playlist / album) ────────────────────────

export type SpotifyEntityKind = 'track' | 'playlist' | 'album';

export interface SpotifyEntityRef {
  kind: SpotifyEntityKind;
  id: string;
}

/**
 * Parses a Spotify URL (or `spotify:type:id` URI) and returns the entity
 * type + id. Recognises `track`, `playlist`, and `album`. Returns null for
 * anything else (artists, episodes, shows, user URLs, etc).
 */
export function parseSpotifyEntity(input: string): SpotifyEntityRef | null {
  const s = (input ?? '').trim();
  if (!s) return null;

  // open.spotify.com URL form (with optional /intl-xx locale segment)
  const url = s.match(
    /open\.spotify\.com(?:\/[a-z-]+)?\/(track|playlist|album)\/([A-Za-z0-9]+)/i,
  );
  if (url) return { kind: url[1].toLowerCase() as SpotifyEntityKind, id: url[2] };

  // spotify:type:id URI form
  const uri = s.match(/^spotify:(track|playlist|album):([A-Za-z0-9]+)$/i);
  if (uri) return { kind: uri[1].toLowerCase() as SpotifyEntityKind, id: uri[2] };

  return null;
}

/** Lightweight track shape we use for indirect resolution via Lavalink. */
export interface SpotifyTrackLite {
  title: string;
  artist: string;
  durationMs: number;
}

function liteFromTrackObject(t: any): SpotifyTrackLite | null {
  if (!t || !t.name) return null;
  const artist = (t.artists ?? [])
    .map((a: any) => a?.name)
    .filter(Boolean)
    .join(', ');
  return {
    title: t.name,
    artist: artist || 'Unknown',
    durationMs: t.duration_ms ?? 0,
  };
}

/** Fetch a single Spotify track's name + primary artist for indirect resolve. */
export async function getTrackLite(trackId: string): Promise<SpotifyTrackLite | null> {
  const res = await spotifyGet<any>(`/tracks/${encodeURIComponent(trackId)}`);
  if (!res.ok) return null;
  return liteFromTrackObject(res.data);
}

/** Fetch a single Spotify album's tracks (paginated; capped at 100). */
export async function getAlbumTracksLite(
  albumId: string,
  max = 100,
): Promise<SpotifyTrackLite[]> {
  const out: SpotifyTrackLite[] = [];
  let offset = 0;
  const limit = 50;
  while (out.length < max) {
    const res = await spotifyGet<any>(
      `/albums/${encodeURIComponent(albumId)}/tracks?limit=${limit}&offset=${offset}`,
    );
    if (!res.ok) break;
    const items = res.data?.items ?? [];
    if (!items.length) break;
    for (const t of items) {
      const lite = liteFromTrackObject(t);
      if (lite) out.push(lite);
      if (out.length >= max) break;
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return out;
}

/** Fetch a Spotify playlist's tracks (paginated; capped at `max`). */
export async function getPlaylistTracksLite(
  playlistId: string,
  max = 100,
): Promise<SpotifyTrackLite[]> {
  const out: SpotifyTrackLite[] = [];
  let offset = 0;
  const limit = 100;
  while (out.length < max) {
    const res = await spotifyGet<any>(
      `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}&offset=${offset}&fields=items(track(name,artists(name),duration_ms))`,
    );
    if (!res.ok) break;
    const items = res.data?.items ?? [];
    if (!items.length) break;
    for (const it of items) {
      const lite = liteFromTrackObject(it?.track);
      if (lite) out.push(lite);
      if (out.length >= max) break;
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return out;
}

/** Fetch a playlist's display name (used for the playlist card title). */
export async function getPlaylistName(playlistId: string): Promise<string | null> {
  const res = await spotifyGet<any>(
    `/playlists/${encodeURIComponent(playlistId)}?fields=name`,
  );
  if (!res.ok) return null;
  return res.data?.name ?? null;
}

/** Fetch an album's display name. */
export async function getAlbumName(albumId: string): Promise<string | null> {
  const res = await spotifyGet<any>(
    `/albums/${encodeURIComponent(albumId)}?fields=name`,
  );
  if (!res.ok) return null;
  return res.data?.name ?? null;
}

// ── User profile ──────────────────────────────────────────────────────────

export interface SpotifyUserProfile {
  id: string;
  display_name: string | null;
  followers: number;
  imageUrl: string | null;
  externalUrl: string;
}

/**
 * Fetch a Spotify user profile. If the primary `/users/{id}` endpoint is
 * blocked (403 — typically the "owner needs Premium" wall), we try the
 * `/users/{id}/playlists?limit=1` endpoint as an existence check — that one
 * is sometimes accessible when the primary user endpoint isn't, and a 200
 * (even with empty items) confirms the user exists. In that fallback path we
 * return a minimal profile (id + externalUrl, no display_name / image /
 * followers). Genuine 404s bubble up as `kind: 'notFound'`.
 */
export async function getUserProfile(
  spotifyId: string,
): Promise<SpotifyResult<SpotifyUserProfile>> {
  const primary = await spotifyGet<any>(`/users/${encodeURIComponent(spotifyId)}`);
  if (primary.ok) {
    const data = primary.data;
    if (!data?.id) return { ok: false, kind: 'badResponse' };
    return {
      ok: true,
      data: {
        id: data.id,
        display_name: data.display_name ?? null,
        followers: data.followers?.total ?? 0,
        imageUrl: data.images?.[0]?.url ?? null,
        externalUrl: data.external_urls?.spotify ?? `https://open.spotify.com/user/${data.id}`,
      },
    };
  }

  // 404 is final — the user genuinely doesn't exist.
  if (isSpotifyFailure(primary) && primary.kind === 'notFound') return primary;

  // For 403 / unauthorized / rate-limited / server / network / badResponse we
  // try the playlists endpoint as an existence probe. If THAT works we still
  // return a partial profile so the user can finish linking.
  const probe = await spotifyGet<any>(
    `/users/${encodeURIComponent(spotifyId)}/playlists?limit=1`,
  );
  if (probe.ok) {
    return {
      ok: true,
      data: {
        id: spotifyId,
        display_name: null,
        followers: 0,
        imageUrl: null,
        externalUrl: `https://open.spotify.com/user/${spotifyId}`,
      },
    };
  }

  // Probe also failed — bubble up the *primary* failure since it's usually
  // the more informative one (the playlists endpoint repeats whatever the
  // base permission issue is).
  return primary as SpotifyFailure;
}

// ── Playlists ─────────────────────────────────────────────────────────────

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  imageUrl: string | null;
  externalUrl: string;
  ownerName: string | null;
}

/**
 * Returns up to `max` public playlists for the given Spotify user. Walks the
 * paginated endpoint until exhausted or the cap is hit. On any failure
 * returns an empty array (callers already handle the empty case gracefully).
 */
export async function getUserPlaylists(
  spotifyId: string,
  max = 100,
): Promise<SpotifyPlaylistSummary[]> {
  const out: SpotifyPlaylistSummary[] = [];
  let offset = 0;
  const limit = 50;
  while (out.length < max) {
    const res = await spotifyGet<any>(
      `/users/${encodeURIComponent(spotifyId)}/playlists?limit=${limit}&offset=${offset}`,
    );
    if (!res.ok) break;
    const data = res.data;
    if (!data?.items?.length) break;
    for (const p of data.items) {
      if (!p) continue;
      out.push({
        id: p.id,
        name: p.name ?? 'Untitled playlist',
        trackCount: p.tracks?.total ?? 0,
        imageUrl: p.images?.[0]?.url ?? null,
        externalUrl: p.external_urls?.spotify ?? `https://open.spotify.com/playlist/${p.id}`,
        ownerName: p.owner?.display_name ?? null,
      });
      if (out.length >= max) break;
    }
    if (data.items.length < limit) break;
    offset += limit;
  }
  return out;
}
