// soul/helpers/playerRetry.ts
//
// Shared one-shot auto-recovery helper used by both `playerStuck` and
// `playerException` events. When a track fails on its source — either Lavalink
// stalled receiving frames or it raised a playback exception — we re-resolve
// `<artist> <title>` via a *different* source-search prefix and play that
// alternate version in place of the failed one.
//
// Performance:
//   The previous implementation did `queue.unshift(retry); player.skip();`
//   which forced a 4-roundtrip cascade (stopTrack → 'end' event → Kazagumo
//   internal play() → resolve → playTrack). We now use
//   `player.play(retry, { replaceCurrent: true })` which is a single
//   `playTrack` roundtrip on Lavalink (the already-encoded retry track's
//   `.resolve()` early-outs immediately). Recovery latency goes from
//   ~500-1500ms to ~50-150ms.
//
// Session-queue correctness:
//   The retry track inherits the failed track's `_sessionEntryId`, and we
//   update the corresponding session entry's `.track` reference in place.
//   This way `syncToPlayer` (called in `playerStart`) matches by id on the
//   first try and `currentIndex` stays put, instead of falling through to
//   the "unknown track → append at end" branch which made the now-playing
//   panel report the recovered track at the LAST queue position while real
//   upcoming tracks looked like history.
//
// Loop guard:
//   The alternate is tagged `_autoRetried = true`. Both event handlers consult
//   this flag and skip without retrying again — so a stuck-then-error or
//   error-then-stuck chain still terminates after one retry total.

import { unifiedSearch } from './sourceSearch.js';
import { getSession } from './sessionQueue.js';
import logger from '../console/logger.js';

const RETRY_ORDER = ['dzsearch', 'ytmsearch', 'scsearch'];

/**
 * Returns the first prefix in RETRY_ORDER that doesn't match the original
 * source. Maps Lavalink sourceName values back to their equivalent search
 * prefix so we don't retry on the same source that just failed.
 */
export function pickRetrySource(originalSourceName?: string): string {
  const orig = (originalSourceName ?? '').toLowerCase();
  const avoid =
    orig === 'youtube' || orig === 'youtubemusic'
      ? 'ytmsearch'
      : orig === 'deezer'
        ? 'dzsearch'
        : orig === 'soundcloud'
          ? 'scsearch'
          : '';
  for (const p of RETRY_ORDER) {
    if (p !== avoid) return p;
  }
  return 'dzsearch';
}

/**
 * Re-resolves "<artist> <title>" via the chosen alternate source and, on
 * success, swaps it in for the failed track via `player.play(retry, {
 * replaceCurrent: true })`. Inherits `_sessionEntryId` and updates the
 * matching session entry's `.track` so `syncToPlayer` keeps `currentIndex`
 * pinned at the same row.
 *
 * Returns the alternate track on success, or `null` if the resolve produced
 * nothing (caller is responsible for the failure UI + plain skip).
 */
export async function resolveAndInjectAlternate(
  client: any,
  player: any,
  originalTrack: any,
  retrySource: string,
): Promise<any | null> {
  const queryParts = [originalTrack?.author, originalTrack?.title].filter(Boolean) as string[];
  if (!queryParts.length) return null;
  const retryQuery = `${retrySource}:${queryParts.join(' ')}`.trim();

  let retryTrack: any = null;
  try {
    const result = await unifiedSearch(client, retryQuery, originalTrack.requester ?? null);
    retryTrack = result.tracks?.[0] ?? null;
  } catch (err) {
    logger.warn('PLAYER', `Auto-retry resolve failed: ${(err as Error).message}`);
    return null;
  }

  if (!retryTrack) return null;

  retryTrack._autoRetried = true;
  if (originalTrack.requester && !retryTrack.requester) {
    retryTrack.requester = originalTrack.requester;
  }

  // Inherit the original's session entry id and rewrite the entry's .track
  // reference in place — so syncToPlayer matches by id and keeps currentIndex
  // pinned to the SAME row, instead of appending the retry at the tail (which
  // is what produced the "Now playing (last index)" bug).
  const inheritedId: string | undefined = originalTrack?._sessionEntryId;
  if (inheritedId) {
    retryTrack._sessionEntryId = inheritedId;
    try {
      const session = getSession(player);
      const idx = session.entries.findIndex((e: any) => e.id === inheritedId);
      if (idx !== -1) session.entries[idx].track = retryTrack;
    } catch {
      // If session lookup fails, syncToPlayer will fall back to its
      // identifier+title scan; no fatal error.
    }
  }

  // Single-roundtrip swap: Lavalink fires 'end' (reason='replaced') then
  // 'start' for the new track. No skip→end→play cascade.
  try {
    await player.play(retryTrack, { replaceCurrent: true });
  } catch (err) {
    logger.warn('PLAYER', `Auto-retry play failed: ${(err as Error).message}`);
    return null;
  }
  return retryTrack;
}
