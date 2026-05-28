// soul/helpers/sourceSearch.ts
//
// Custom search helper that bypasses Kazagumo's built-in `search()` (which only
// supports YouTube / YouTube Music / SoundCloud) and calls Lavalink's REST
// `loadtracks` directly via Shoukaku. This lets us use any source supported by
// the LavaSrc plugin on the Lavalink node (Spotify, Deezer, Apple Music, Yandex
// Music, etc.) for both URL passthrough AND prefixed text searches.
//
// Routing rules for an input `query`:
//   1. Spotify URL/URI (track / playlist / album)  → try LavaSrc passthrough
//      first. If that returns empty / errors, fall back to indirect resolution
//      via the Spotify Web API (`spotifyClient.ts`): fetch metadata, then
//      resolve each track's "<artist> <title>" via the FALLBACK_SOURCES
//      chain on Lavalink. This is what makes Spotify URLs keep working even
//      when the LavaSrc Spotify resolver is broken on the node.
//   2. Other URL / known prefix → pass through. If the resolved result is a
//      single track or empty, we leave it as-is.
//   3. Plain text → try `config.defaultSource` first, then walk the
//      FALLBACK_SOURCES chain until something returns tracks. This dramatically
//      reduces "no results" failures when one source is degraded.
//
// The raw Lavalink response is wrapped into KazagumoTrack instances so the rest
// of the bot (queue, now-playing panel, etc.) keeps working unchanged.

import { KazagumoTrack } from 'kazagumo';
import { LoadType } from 'shoukaku';
import config from '../config.js';
import logger from '../console/logger.js';
import {
  isSpotifyConfigured,
  parseSpotifyEntity,
  getTrackLite,
  getAlbumName,
  getAlbumTracksLite,
  getPlaylistName,
  getPlaylistTracksLite,
  type SpotifyTrackLite,
} from './spotifyClient.js';

/** Source prefixes recognised by Lavalink + LavaSrc plugin. */
export const KNOWN_SOURCE_PREFIXES = [
  'ytsearch:',
  'ytmsearch:',
  'scsearch:',
  'spsearch:',
  'dzsearch:',
  'amsearch:',
  'ymsearch:',
];

/**
 * Plain-text fallback chain. Walked in order until one returns tracks.
 * `dzsearch` first because Deezer streaming is the most reliable on most
 * Lavalink + LavaSrc setups; `ytmsearch` second for catalog coverage;
 * `scsearch` last as the universal fallback.
 */
const FALLBACK_SOURCES = ['dzsearch', 'ytmsearch', 'scsearch'];

const URL_RE = /^https?:\/\//i;

export interface UnifiedSearchResult {
  type: 'TRACK' | 'PLAYLIST' | 'SEARCH';
  tracks: KazagumoTrack[];
  playlistName?: string;
}

function pickReadyNode(client: any): any | null {
  // Shoukaku.nodes is a Map<string, Node>; node.state === 1 means CONNECTED.
  const nodes: Iterable<any> = client.kazagumo?.shoukaku?.nodes?.values?.() ?? [];
  for (const n of nodes) {
    if (n?.state === 1) return n;
  }
  return null;
}

/**
 * Single resolve call against Lavalink. Returns the raw `loadtracks` result
 * or null on network/HTTP error.
 */
async function rawResolve(node: any, query: string): Promise<any | null> {
  return node.rest.resolve(query).catch((): null => null);
}

/**
 * Shape a raw Lavalink track into a KazagumoTrack.
 */
function makeWrapper(client: any, requester: any) {
  return (raw: any): KazagumoTrack => {
    const t = new KazagumoTrack(raw, requester);
    t.setKazagumo(client.kazagumo);
    return t;
  };
}

/**
 * Walk FALLBACK_SOURCES (skipping `skip` if given) and return the first
 * non-empty SEARCH result. Returns null if every source is empty.
 */
async function fallbackSearchChain(
  node: any,
  text: string,
  skip?: string,
): Promise<{ source: string; raw: any } | null> {
  for (const src of FALLBACK_SOURCES) {
    if (src === skip) continue;
    const r = await rawResolve(node, `${src}:${text}`);
    if (
      r &&
      (r.loadType === LoadType.SEARCH || r.loadType === LoadType.TRACK) &&
      ((Array.isArray(r.data) && r.data.length > 0) || (!Array.isArray(r.data) && r.data))
    ) {
      return { source: src, raw: r };
    }
  }
  return null;
}

/**
 * Resolve one Spotify-track-lite via the Lavalink fallback chain. Returns
 * the first matching raw Lavalink track, or null if every source came up
 * empty.
 */
async function resolveLiteOnLavalink(
  node: any,
  lite: SpotifyTrackLite,
): Promise<any | null> {
  const text = `${lite.artist} ${lite.title}`.trim();
  if (!text) return null;
  const chain = await fallbackSearchChain(node, text);
  if (!chain) return null;
  // SEARCH returns array, TRACK returns single object — normalize to first track.
  if (Array.isArray(chain.raw.data)) return chain.raw.data[0] ?? null;
  return chain.raw.data ?? null;
}

/**
 * Indirect Spotify resolve path: when the Lavalink LavaSrc Spotify resolver
 * can't handle a Spotify URL (broken creds on the node, plugin missing,
 * etc.), we fetch the metadata via our own Spotify Web API client and
 * re-resolve each track via the Lavalink fallback chain. Tracks that can't
 * be matched on any source are silently dropped (rather than failing the
 * whole playlist).
 */
async function indirectSpotifyResolve(
  client: any,
  node: any,
  url: string,
  requester: any,
): Promise<UnifiedSearchResult | null> {
  if (!isSpotifyConfigured()) return null;
  const ref = parseSpotifyEntity(url);
  if (!ref) return null;

  const wrap = makeWrapper(client, requester);

  if (ref.kind === 'track') {
    const lite = await getTrackLite(ref.id);
    if (!lite) return null;
    const raw = await resolveLiteOnLavalink(node, lite);
    if (!raw) return null;
    return { type: 'TRACK', tracks: [wrap(raw)] };
  }

  if (ref.kind === 'playlist' || ref.kind === 'album') {
    const [name, lites] =
      ref.kind === 'playlist'
        ? await Promise.all([getPlaylistName(ref.id), getPlaylistTracksLite(ref.id, 100)])
        : await Promise.all([getAlbumName(ref.id), getAlbumTracksLite(ref.id, 100)]);

    if (!lites.length) return null;

    // Resolve in small parallel batches so a long playlist doesn't take 60s.
    const BATCH = 8;
    const tracks: KazagumoTrack[] = [];
    for (let i = 0; i < lites.length; i += BATCH) {
      const batch = lites.slice(i, i + BATCH);
      const resolved = await Promise.all(batch.map((l) => resolveLiteOnLavalink(node, l)));
      for (const raw of resolved) {
        if (raw) tracks.push(wrap(raw));
      }
    }

    if (!tracks.length) return null;
    return {
      type: 'PLAYLIST',
      playlistName: name ?? (ref.kind === 'playlist' ? 'Spotify Playlist' : 'Spotify Album'),
      tracks,
    };
  }

  return null;
}

export async function unifiedSearch(
  client: any,
  rawQuery: string,
  requester: any,
): Promise<UnifiedSearchResult> {
  const query = (rawQuery ?? '').trim();
  if (!query) return { type: 'SEARCH', tracks: [] };

  const node = pickReadyNode(client);
  if (!node) return { type: 'SEARCH', tracks: [] };

  const isUrl = URL_RE.test(query);
  const lower = query.toLowerCase();
  const hasPrefix = KNOWN_SOURCE_PREFIXES.some((p) => lower.startsWith(p));

  const wrap = makeWrapper(client, requester);
  const isSpotifyUrl = isUrl && /open\.spotify\.com|^spotify:/i.test(query);

  // ── 1. URL or already-prefixed: try the direct passthrough first.
  if (isUrl || hasPrefix) {
    const direct = await rawResolve(node, query);
    const directHasData =
      direct &&
      direct.loadType !== LoadType.EMPTY &&
      direct.loadType !== LoadType.ERROR &&
      (direct.loadType === LoadType.PLAYLIST
        ? (direct.data?.tracks?.length ?? 0) > 0
        : direct.loadType === LoadType.SEARCH
          ? (direct.data?.length ?? 0) > 0
          : !!direct.data);

    if (directHasData) {
      switch (direct.loadType) {
        case LoadType.TRACK:
          return { type: 'TRACK', tracks: [wrap(direct.data)] };
        case LoadType.PLAYLIST:
          return {
            type: 'PLAYLIST',
            playlistName: direct.data?.info?.name ?? 'Unknown Playlist',
            tracks: (direct.data?.tracks ?? []).map(wrap),
          };
        case LoadType.SEARCH:
          return { type: 'SEARCH', tracks: (direct.data ?? []).map(wrap) };
      }
    }

    // Direct resolve was empty/errored. Special-case Spotify URLs by going
    // through the Web API + Lavalink fallback chain.
    if (isSpotifyUrl) {
      const indirect = await indirectSpotifyResolve(client, node, query, requester);
      if (indirect) {
        logger.warn(
          'SEARCH',
          `Spotify direct resolve failed; recovered ${indirect.tracks.length} track(s) via indirect fallback`,
        );
        return indirect;
      }
    }

    return { type: 'SEARCH', tracks: [] };
  }

  // ── 2. Plain text: try defaultSource first, then walk FALLBACK_SOURCES.
  const defaultSource: string = (config as any).defaultSource || 'ytmsearch';
  const primary = await rawResolve(node, `${defaultSource}:${query}`);
  if (
    primary &&
    primary.loadType === LoadType.SEARCH &&
    (primary.data?.length ?? 0) > 0
  ) {
    return { type: 'SEARCH', tracks: (primary.data ?? []).map(wrap) };
  }
  if (
    primary &&
    primary.loadType === LoadType.TRACK &&
    primary.data
  ) {
    return { type: 'TRACK', tracks: [wrap(primary.data)] };
  }
  if (
    primary &&
    primary.loadType === LoadType.PLAYLIST &&
    (primary.data?.tracks?.length ?? 0) > 0
  ) {
    return {
      type: 'PLAYLIST',
      playlistName: primary.data?.info?.name ?? 'Unknown Playlist',
      tracks: (primary.data?.tracks ?? []).map(wrap),
    };
  }

  // Primary returned nothing — walk the fallback chain (skip the source we
  // already tried).
  const fallback = await fallbackSearchChain(node, query, defaultSource);
  if (fallback) {
    if (Array.isArray(fallback.raw.data)) {
      return { type: 'SEARCH', tracks: fallback.raw.data.map(wrap) };
    }
    return { type: 'TRACK', tracks: [wrap(fallback.raw.data)] };
  }

  return { type: 'SEARCH', tracks: [] };
}
