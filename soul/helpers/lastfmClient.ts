// soul/helpers/lastfmClient.ts
//
// Tiny Last.fm Web Services wrapper. All public read-only endpoints need only
// an API key (LASTFM_API_KEY env var). Native `fetch` — no npm package.
//
// Last.fm API docs: https://www.last.fm/api

import config from '../config.js';

const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

export function isLastfmConfigured(): boolean {
  return !!config.lastfm.apiKey;
}

/**
 * Generic GET. Pass the `method` (e.g. 'user.getInfo') and any extra params.
 * Returns the raw JSON `responseBody` or `null` on error / missing key.
 */
export async function lastfmGet(
  method: string,
  params: Record<string, string | number | undefined> = {},
): Promise<any | null> {
  if (!isLastfmConfigured()) return null;
  const url = new URL(API_BASE);
  url.searchParams.set('method', method);
  url.searchParams.set('api_key', config.lastfm.apiKey!);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'HermacaDiscordBot/1.0' },
  }).catch((): null => null);
  if (!res) return null;
  const data: any = await res.json().catch((): null => null);
  if (!data) return null;
  // Last.fm returns 200 with `{ error, message }` on bad requests.
  if (data.error) return null;
  return data;
}

/** Returns `true` if the username exists on Last.fm. */
export async function userExists(username: string): Promise<boolean> {
  const data = await lastfmGet('user.getInfo', { user: username });
  return !!data?.user?.name;
}

// ── Convenience wrappers — every command file uses these ──────────────────

export async function userGetInfo(user: string) {
  const d = await lastfmGet('user.getInfo', { user });
  return d?.user ?? null;
}

export async function userGetRecentTracks(user: string, limit = 10, page = 1) {
  const d = await lastfmGet('user.getRecentTracks', { user, limit, page, extended: 1 });
  return d?.recenttracks ?? null;
}

export async function userGetTopArtists(user: string, period = 'overall', limit = 10, page = 1) {
  const d = await lastfmGet('user.getTopArtists', { user, period, limit, page });
  return d?.topartists ?? null;
}

export async function userGetTopAlbums(user: string, period = 'overall', limit = 10, page = 1) {
  const d = await lastfmGet('user.getTopAlbums', { user, period, limit, page });
  return d?.topalbums ?? null;
}

export async function userGetTopTracks(user: string, period = 'overall', limit = 10, page = 1) {
  const d = await lastfmGet('user.getTopTracks', { user, period, limit, page });
  return d?.toptracks ?? null;
}

export async function userGetTopTags(user: string, limit = 10) {
  const d = await lastfmGet('user.getTopTags', { user, limit });
  return d?.toptags ?? null;
}

export async function userGetLovedTracks(user: string, limit = 10, page = 1) {
  const d = await lastfmGet('user.getLovedTracks', { user, limit, page });
  return d?.lovedtracks ?? null;
}

export async function userGetFriends(user: string, limit = 10, page = 1) {
  const d = await lastfmGet('user.getFriends', { user, limit, page });
  return d?.friends ?? null;
}

export async function userGetWeeklyArtistChart(user: string) {
  const d = await lastfmGet('user.getWeeklyArtistChart', { user });
  return d?.weeklyartistchart ?? null;
}

export async function userGetWeeklyAlbumChart(user: string) {
  const d = await lastfmGet('user.getWeeklyAlbumChart', { user });
  return d?.weeklyalbumchart ?? null;
}

export async function userGetWeeklyTrackChart(user: string) {
  const d = await lastfmGet('user.getWeeklyTrackChart', { user });
  return d?.weeklytrackchart ?? null;
}

export async function trackGetInfo(artist: string, track: string, username?: string) {
  const d = await lastfmGet('track.getInfo', { artist, track, username, autocorrect: 1 });
  return d?.track ?? null;
}

export async function trackGetSimilar(artist: string, track: string, limit = 10) {
  const d = await lastfmGet('track.getSimilar', { artist, track, limit, autocorrect: 1 });
  return d?.similartracks ?? null;
}

export async function artistGetInfo(artist: string, username?: string) {
  const d = await lastfmGet('artist.getInfo', { artist, username, autocorrect: 1 });
  return d?.artist ?? null;
}

export async function artistGetTopTracks(artist: string, limit = 10) {
  const d = await lastfmGet('artist.getTopTracks', { artist, limit, autocorrect: 1 });
  return d?.toptracks ?? null;
}

export async function artistGetTopAlbums(artist: string, limit = 10) {
  const d = await lastfmGet('artist.getTopAlbums', { artist, limit, autocorrect: 1 });
  return d?.topalbums ?? null;
}

export async function artistGetSimilar(artist: string, limit = 10) {
  const d = await lastfmGet('artist.getSimilar', { artist, limit, autocorrect: 1 });
  return d?.similarartists ?? null;
}

export async function albumGetInfo(artist: string, album: string, username?: string) {
  const d = await lastfmGet('album.getInfo', { artist, album, username, autocorrect: 1 });
  return d?.album ?? null;
}

export async function tagGetTopArtists(tag: string, limit = 10) {
  const d = await lastfmGet('tag.getTopArtists', { tag, limit });
  return d?.topartists ?? null;
}

export async function tagGetTopTracks(tag: string, limit = 10) {
  const d = await lastfmGet('tag.getTopTracks', { tag, limit });
  return d?.tracks ?? null;
}

export async function tagGetTopAlbums(tag: string, limit = 10) {
  const d = await lastfmGet('tag.getTopAlbums', { tag, limit });
  return d?.albums ?? null;
}

export async function chartGetTopArtists(limit = 10) {
  const d = await lastfmGet('chart.getTopArtists', { limit });
  return d?.artists ?? null;
}

export async function chartGetTopTracks(limit = 10) {
  const d = await lastfmGet('chart.getTopTracks', { limit });
  return d?.tracks ?? null;
}

export async function chartGetTopTags(limit = 10) {
  const d = await lastfmGet('chart.getTopTags', { limit });
  return d?.tags ?? null;
}

export async function geoGetTopArtists(country: string, limit = 10) {
  const d = await lastfmGet('geo.getTopArtists', { country, limit });
  return d?.topartists ?? null;
}

export async function geoGetTopTracks(country: string, limit = 10) {
  const d = await lastfmGet('geo.getTopTracks', { country, limit });
  return d?.tracks ?? null;
}
