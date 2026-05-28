// soul/helpers/sessionQueue.ts
//
// Single source of truth for the per-player "session queue" — the full
// chronological list of tracks the bot has been asked to play in the current
// listening session (since the player was created / queue was emptied).
//
//   completed tracks  +  now-playing track  +  upcoming tracks
//
// The data lives in player.data ('sessionQueue' key) so it dies with the
// player — exactly what we want, since destroying the player marks the end
// of the session.
//
// The helper also exposes mutation functions used by every command/event that
// touches the queue (play, add, remove, move, clear, shuffle, skip-ish ops,
// trackStart). Going through the helper keeps the session queue in sync with
// what Kazagumo's `player.queue` is actually doing — drift is the #1 risk.

import { randomUUID } from 'node:crypto';
import { cloneTrack, type CloneableTrack } from '../utils/trackClone.js';

// ────────────────────────────── Types ──────────────────────────────

export interface SessionEntry {
  /** Stable id used to identify this entry across queue mutations. */
  id: string;
  /** The Kazagumo track instance (or a clone of it). */
  track: any;
  /** User who queued it (Discord User-like, may be undefined for autoplay). */
  requester: any;
  /** When the entry was added to the session, in ms epoch. */
  addedAt: number;
}

export interface SessionState {
  entries: SessionEntry[];
  /**
   * Index into `entries` of the currently-playing (or about-to-play) track.
   *  -1  →  no track has started yet (queue may have entries waiting to play)
   *   N  →  entries[N] is currently playing
   * Completed history = entries[0..currentIndex-1]
   * Upcoming           = entries[currentIndex+1..end]
   */
  currentIndex: number;
}

const SESSION_KEY = 'sessionQueue';
/** Cap session length so 24/7 channels don't grow unbounded. FIFO from the head. */
const MAX_SESSION_LENGTH = 500;

// ────────────────────────────── Core access ──────────────────────────────

export function getSession(player: any): SessionState {
  let s: SessionState | undefined = player.data?.get?.(SESSION_KEY);
  if (!s) {
    s = { entries: [], currentIndex: -1 };
    player.data?.set?.(SESSION_KEY, s);
  }
  return s;
}

export function clearSession(player: any): void {
  player.data?.set?.(SESSION_KEY, { entries: [], currentIndex: -1 });
}

function tagTrack(track: any, entryId: string): void {
  // Mark the track instance with the entry id so trackStart can map it back
  // even after Kazagumo passes it through Lavalink and back.
  if (track && typeof track === 'object') {
    track._sessionEntryId = entryId;
  }
}

function makeEntry(track: any, requester: any): SessionEntry {
  const id = randomUUID();
  tagTrack(track, id);
  return { id, track, requester, addedAt: Date.now() };
}

function trimToCap(state: SessionState): void {
  while (state.entries.length > MAX_SESSION_LENGTH) {
    state.entries.shift();
    if (state.currentIndex >= 0) state.currentIndex -= 1;
  }
}

// ────────────────────────────── Mutations ──────────────────────────────

/**
 * Append one or more tracks to the end of the session queue. Used by `play`.
 */
export function addTracks(player: any, tracks: any[], requester: any): void {
  if (!tracks?.length) return;
  const state = getSession(player);
  for (const t of tracks) state.entries.push(makeEntry(t, requester));
  trimToCap(state);
}

/**
 * Insert one or more tracks at a 1-based position relative to the upcoming
 * queue (position 1 = next to play). Used by `add`.
 */
export function insertTracks(
  player: any,
  position: number,
  tracks: any[],
  requester: any,
): void {
  if (!tracks?.length) return;
  const state = getSession(player);
  // currentIndex+1 is the head of upcoming; offset by (position-1).
  const insertAt = Math.max(state.currentIndex + 1, 0) + (position - 1);
  const entries = tracks.map(t => makeEntry(t, requester));
  state.entries.splice(insertAt, 0, ...entries);
  trimToCap(state);
}

/**
 * Remove the upcoming entry at 1-based position (position 1 = next to play).
 * Used by `remove`.
 */
export function removeUpcoming(player: any, position: number): void {
  const state = getSession(player);
  const idx = Math.max(state.currentIndex + 1, 0) + (position - 1);
  if (idx < state.entries.length && idx > state.currentIndex) {
    state.entries.splice(idx, 1);
  }
}

/**
 * Move an upcoming entry from one 1-based position to another.
 * Used by `move`.
 */
export function moveUpcoming(player: any, from: number, to: number): void {
  const state = getSession(player);
  const base = Math.max(state.currentIndex + 1, 0);
  const fromIdx = base + (from - 1);
  const toIdx = base + (to - 1);
  if (
    fromIdx <= state.currentIndex ||
    toIdx <= state.currentIndex ||
    fromIdx >= state.entries.length ||
    toIdx >= state.entries.length ||
    fromIdx === toIdx
  ) return;
  const [entry] = state.entries.splice(fromIdx, 1);
  state.entries.splice(toIdx, 0, entry);
}

/**
 * Drop every upcoming entry (keeps completed history + now-playing).
 * Used by `clear`.
 */
export function clearUpcoming(player: any): void {
  const state = getSession(player);
  if (state.currentIndex < 0) {
    state.entries = [];
  } else {
    state.entries.length = state.currentIndex + 1;
  }
}

/**
 * Shuffle the upcoming entries in place. Used by `shuffle`.
 */
export function shuffleUpcoming(player: any): void {
  const state = getSession(player);
  const start = state.currentIndex + 1;
  for (let i = state.entries.length - 1; i > start; i--) {
    const j = start + Math.floor(Math.random() * (i - start + 1));
    [state.entries[i], state.entries[j]] = [state.entries[j], state.entries[i]];
  }
}

// ────────────────────────────── Sync from playback ──────────────────────────────

/**
 * Re-aligns `currentIndex` with what Kazagumo says is currently playing.
 * Called from `trackStart` (and after manual jumps).
 *
 * Match strategy, in order:
 *   1. _sessionEntryId on the playing track equals an entry id → use that.
 *   2. Search forward from currentIndex+1 by identifier+title (handles
 *      cases where Kazagumo handed back a fresh track instance, e.g. via
 *      queue-loop re-queueing).
 *   3. Search backward from currentIndex-1 by identifier+title (handles
 *      queue-loop wrap-around, manual rewind without _sessionEntryId).
 *   4. Append a brand-new entry (autoplay tracks, anything that bypassed
 *      the helper) and point currentIndex at it.
 */
export function syncToPlayer(player: any): void {
  const state = getSession(player);
  const current = player.queue?.current;
  if (!current) return;

  // 1. id match
  const tagged: string | undefined = current._sessionEntryId;
  if (tagged) {
    const idx = state.entries.findIndex(e => e.id === tagged);
    if (idx !== -1) {
      state.currentIndex = idx;
      return;
    }
  }

  const matches = (e: SessionEntry): boolean =>
    e.track?.identifier === current.identifier && e.track?.title === current.title;

  // 2. forward scan
  for (let i = state.currentIndex + 1; i < state.entries.length; i++) {
    if (matches(state.entries[i])) {
      tagTrack(current, state.entries[i].id);
      state.currentIndex = i;
      return;
    }
  }

  // 3. backward scan (queue-loop wrap-around, manual rewind fallback)
  for (let i = state.currentIndex - 1; i >= 0; i--) {
    if (matches(state.entries[i])) {
      tagTrack(current, state.entries[i].id);
      state.currentIndex = i;
      return;
    }
  }

  // 4. unknown track (autoplay etc) — append.
  const entry = makeEntry(current, current.requester);
  state.entries.push(entry);
  trimToCap(state);
  state.currentIndex = state.entries.indexOf(entry);
}

// ────────────────────────────── Jump (rewind / fast-forward) ──────────────────────────────

/**
 * Jump to an absolute entry index. The implementation differs by direction:
 *
 *  • Forward (target > currentIndex):
 *      Splice tracks (target - currentIndex - 1) off the front of the
 *      *upcoming* queue (since `current` is not in player.queue), then
 *      `player.skip()` so Kazagumo advances to the target.
 *
 *  • Backward (target < currentIndex):
 *      Kazagumo can't go backward natively. We rebuild player.queue by:
 *        a) clearing it
 *        b) cloning entries[target..end] and pushing them onto player.queue
 *           (the first one becomes the next thing to play after skip)
 *        c) calling player.skip() to abandon the current track
 *      `currentIndex` is *pre-set* to (target - 1) so the trackStart sync
 *      lands on `target` exactly. Completed history (entries[0..target-1])
 *      is left untouched.
 *
 *  • target === currentIndex → no-op.
 *
 * Returns the new currentIndex (or the old one if nothing happened).
 */
export async function jumpTo(player: any, target: number): Promise<number> {
  const state = getSession(player);
  if (target < 0 || target >= state.entries.length) return state.currentIndex;
  if (target === state.currentIndex) return state.currentIndex;

  if (target > state.currentIndex) {
    // Forward
    const skipBy = target - state.currentIndex - 1;
    if (skipBy > 0) {
      // KazagumoQueue extends Array
      player.queue.splice(0, skipBy);
    }
    // Pre-set currentIndex to the FINAL target so the queue renders correctly
    // immediately (before trackStart fires). syncToPlayer's step-1 id match is
    // independent of currentIndex's prior value, so it'll land on `target`
    // again when trackStart fires — making this a true no-op resync.
    state.currentIndex = target;
    // KazagumoPlayer.skip() returns the player synchronously (NOT a Promise),
    // so wrap in try/catch instead of `.catch(...)` which would crash.
    try { player.skip(); } catch { /* ignore */ }
    return target;
  }

  // Backward
  // Build the replacement upcoming queue from cloned entries (target ... end)
  const newUpcoming: CloneableTrack[] = [];
  for (let i = target; i < state.entries.length; i++) {
    const cloned = cloneTrack(state.entries[i].track);
    // Keep the entry id on the clone so syncToPlayer can match.
    (cloned as any)._sessionEntryId = state.entries[i].id;
    newUpcoming.push(cloned);
  }

  // Replace player.queue contents (KazagumoQueue extends Array).
  player.queue.length = 0;
  for (const t of newUpcoming) player.queue.push(t);

  // Pre-set currentIndex to the FINAL target so the queue renders correctly
  // immediately. trackStart's syncToPlayer step-1 id match will land on the
  // same `target` value, making the resync a no-op.
  state.currentIndex = target;
  // KazagumoPlayer.skip() returns the player synchronously (NOT a Promise),
  // so wrap in try/catch instead of `.catch(...)` which would crash.
  try { player.skip(); } catch { /* ignore */ }
  return target;
}
