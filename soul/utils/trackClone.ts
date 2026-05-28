// soul/utils/trackClone.ts
//
// Clones a KazagumoTrack into a fresh, queueable instance.
//
// Why we need this:
//   Kazagumo / Shoukaku does not support "play previous track" out of the box.
//   To rewind to a track that already finished, we have to put a *new* track
//   instance back into player.queue (re-using the original instance can lead
//   to weird state because Lavalink/Kazagumo mutate per-play fields like
//   `position`, `playing`, etc).
//
//   We rebuild the track using its raw encoded payload — which is what
//   Lavalink itself uses to load tracks — and copy across the user-facing
//   metadata so the now-playing panel renders identically.
//
// We also propagate `_sessionEntryId` (a marker we attach to every track at
// the moment it enters the session queue) so the session-queue resync logic
// in trackStart can match the cloned track back to its original entry.

export interface CloneableTrack {
  track?: string;
  encoded?: string;
  title?: string;
  author?: string;
  uri?: string;
  identifier?: string;
  isStream?: boolean;
  isSeekable?: boolean;
  length?: number;
  position?: number;
  thumbnail?: string;
  sourceName?: string;
  requester?: any;
  _sessionEntryId?: string;
  [k: string]: any;
}

/**
 * Returns a shallow clone of a Kazagumo track that is safe to push back into
 * `player.queue`. The clone preserves the encoded payload (so Lavalink can
 * resolve it) and the _sessionEntryId tag (so the session queue can sync).
 *
 * ⚠ The clone MUST preserve the original prototype chain — KazagumoPlayer.play()
 * calls `current.setKazagumo(this.kazagumo)` on every track, and that method
 * lives on `KazagumoTrack.prototype`. A plain `{ ...track }` spread strips the
 * prototype and produces a bare object that crashes the player. Use
 * `Object.create(Object.getPrototypeOf(track))` + `Object.assign` to copy the
 * own enumerable properties onto a fresh instance with the right prototype.
 */
export function cloneTrack(track: CloneableTrack): CloneableTrack {
  const proto = Object.getPrototypeOf(track) ?? Object.prototype;
  const clone: CloneableTrack = Object.assign(Object.create(proto), track);

  // Reset per-play state — these get rewritten by Kazagumo/Lavalink anyway.
  delete (clone as any).position;
  delete (clone as any).playing;

  return clone;
}
