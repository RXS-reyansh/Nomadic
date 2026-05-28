# Queue Command — Current State

Implemented in `soul/commands/music/queue.ts` + `soul/slashCommands/music/queue.ts`.
Renderer: `soul/components/queueMenu.ts`. Components V2 only.

---

## Layout

```
# {musicHeartNote} __{botName} Music Queue__
─────────────────────────
## Now Playing                                   [thumbnail accessory →]
**N.** (source emoji) [song title](uri) - Artist
**{played}** played ⟡ **{upcoming}** upcoming
**Total session length:** {hh:mm:ss}
─────────────────────────
### Completed:
**1.** (emoji) Song A
> Artist: …
> Requested by username ⟡ 3:12

**2.** (emoji) Song B
> Artist: …
> Requested by username ⟡ 4:01

### Heading Your Way:
**4.** (emoji) Song D
> Artist: …
> Requested by username ⟡ 2:55
…
─────────────────────────
[ Jump dropdown — one option per visible entry on this page ]
[ Previous (grey) ] [ Page X/N (green, opens modal) ] [ Next (grey) ] [ Refresh (grey) ]
─────────────────────────
-# Thank you for using {botName}!
```

Key facts:
- **Title** is the only hyperlinked text in the panel — and only on the Now Playing line.
- **Thumbnail** of the current track sits to the right of the Now Playing block (SectionBuilder + ThumbnailBuilder accessory).
- **Requested by** uses the user's display name (`globalName / displayName / username / tag`), never a `<@id>` mention. `allowedMentions: { parse: [] }` is set on every payload.
- Completed and Heading Your Way live in **one combined text block** (no separator between them). Empty sections are omitted.
- 8 entries per page (`QUEUE_PAGE_SIZE`).
- The panel opens at the page containing the now-playing track (`pageForCurrent`).

---

## Session storage

The session lives on `player.data` under the key `sessionQueue` — it dies when the player is destroyed. No DB persistence.

```ts
interface SessionEntry {
  id: string;            // randomUUID
  track: any;            // Kazagumo track instance
  requester: any;        // Discord User-like
  addedAt: number;       // ms epoch
}
interface SessionState {
  entries: SessionEntry[];   // chronological — completed + current + upcoming
  currentIndex: number;      // -1 = nothing started yet
}
```

Helpers in `soul/helpers/sessionQueue.ts`:
- `addTracks(player, tracks, user)` — append (used by `play`).
- `insertTracks` / `removeUpcoming` / `moveUpcoming` / `clearUpcoming` / `shuffleUpcoming`.
- `syncToPlayer(player)` — re-aligns `currentIndex` on `trackStart` (id match → forward scan → backward scan → append).
- `jumpTo(player, target)` — rewind or fast-forward; pre-sets `currentIndex = target` for instant render.

---

## Interactions

| Custom ID | Component | Behavior |
|---|---|---|
| `queue:jump` | StringSelectMenu | Calls `jumpTo(player, value)`, then re-renders. |
| `queue:prev` / `queue:next` | Button | Decrements/increments `session.page`, re-renders. |
| `queue:goto` | Button (green) | Opens a modal `queue:goto-modal:<messageId>` with a Short text input named `page`. |
| `queue:goto-modal:<id>` | ModalSubmit | Parses page number, clamps via `buildQueuePayload`, fetches the original message and edits it. |
| `queue:refresh` | Button | Re-renders the current page (no state change). |

All handlers live in `soul/events/discord/interactionCreate.ts`. Only the user who opened the panel can navigate it.

Sessions auto-disable after 3 minutes of inactivity (`SESSION_TIMEOUT_MS`), mirrored from `debugMenu.ts`.

---

## Critical rules (footguns we hit)

1. **`KazagumoQueue.add(tracks)` mutates the input array** when there's no current track (it does `tracks.shift()`). In `play.ts`, always call `addTracks(player, tracks, user)` BEFORE `player.queue.add(tracks)`, and capture `firstTrack`/`length` before the `.add()` call. Otherwise the now-playing track is never tagged with `_sessionEntryId` and `currentIndex` lands at `entries.length - 1` instead of 0 for fresh playlists.
2. **`KazagumoPlayer.skip()` is synchronous** — returns the player, NOT a Promise. Wrap in `try { player.skip(); } catch {}`, never `.catch(...)`.
3. **`cloneTrack` must preserve the prototype chain** — `KazagumoPlayer.play()` calls `current.setKazagumo(this.kazagumo)` which lives on `KazagumoTrack.prototype`. A plain `{ ...track }` spread strips the prototype and crashes the next play. Use `Object.assign(Object.create(Object.getPrototypeOf(track)), track)`.
4. **`jumpTo` pre-sets `currentIndex` to the FINAL target** (not `target - 1`) so the panel renders the correct Now Playing immediately, before `trackStart` fires. The id-match path in `syncToPlayer` is independent of the prior value, so it lands on the same target — true no-op resync.

---

## Files

| File | Role |
|---|---|
| `soul/commands/music/queue.ts` | Prefix command — opens the panel. |
| `soul/slashCommands/music/queue.ts` | Slash command builder. |
| `soul/components/queueMenu.ts` | Renderer + session map + timeout machinery. |
| `soul/helpers/sessionQueue.ts` | Session state + all queue mutations. |
| `soul/utils/trackClone.ts` | Prototype-preserving clone for backward jumps. |
| `soul/events/discord/interactionCreate.ts` | Button / select / modal handlers. |
