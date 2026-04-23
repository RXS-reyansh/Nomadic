// soul/helpers/sourceSearch.ts
//
// Custom search helper that bypasses Kazagumo's built-in `search()` (which only
// supports YouTube / YouTube Music / SoundCloud) and calls Lavalink's REST
// `loadtracks` directly via Shoukaku. This lets us use any source supported by
// the LavaSrc plugin on the Lavalink node (Spotify, Deezer, Apple Music, Yandex
// Music, etc.) for both URL passthrough AND prefixed text searches.
//
// Routing rules for an input `query`:
//   1. If it's an http(s) URL  → pass through unchanged (LavaSrc resolves it).
//   2. If it starts with a known source prefix (`spsearch:`, `dzsearch:`, …)
//      → pass through unchanged.
//   3. Otherwise → prepend `${config.defaultSource}:` and resolve.
//
// The raw Lavalink response is wrapped into KazagumoTrack instances so the rest
// of the bot (queue, now-playing panel, etc.) keeps working unchanged.

import { KazagumoTrack } from 'kazagumo';
import { LoadType } from 'shoukaku';
import config from '../config.js';

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

  let resolveQuery: string;
  if (isUrl || hasPrefix) {
    resolveQuery = query;
  } else {
    const defaultSource: string = (config as any).defaultSource || 'ytmsearch';
    resolveQuery = `${defaultSource}:${query}`;
  }

  const result: any = await node.rest
    .resolve(resolveQuery)
    .catch((): null => null);

  if (!result || result.loadType === LoadType.EMPTY) {
    return { type: 'SEARCH', tracks: [] };
  }

  const wrap = (raw: any): KazagumoTrack => {
    const t = new KazagumoTrack(raw, requester);
    t.setKazagumo(client.kazagumo);
    return t;
  };

  switch (result.loadType) {
    case LoadType.TRACK:
      return { type: 'TRACK', tracks: [wrap(result.data)] };
    case LoadType.PLAYLIST:
      return {
        type: 'PLAYLIST',
        playlistName: result.data?.info?.name ?? 'Unknown Playlist',
        tracks: (result.data?.tracks ?? []).map(wrap),
      };
    case LoadType.SEARCH:
      return { type: 'SEARCH', tracks: (result.data ?? []).map(wrap) };
    case LoadType.ERROR:
    default:
      return { type: 'SEARCH', tracks: [] };
  }
}
