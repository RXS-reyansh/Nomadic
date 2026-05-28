# `seek` command — spec

Seek to a specific position inside the currently-playing track.

## Surface

| Field | Value |
|---|---|
| Name | `seek` |
| Aliases | _(none)_ |
| Category | `music` |
| Prefix | yes (`prefixExecute`) |
| Slash | yes (`slashExecute`) |
| `player` | `true` (a player must exist for the guild) |
| `inVoiceChannel` | `true` (invoker must be in a VC) |
| `sameVoiceChannel` | `true` (invoker must share the bot's VC) |
| `isDeveloper` | `false` |
| Cooldown | 2 s |

Files:
- `soul/commands/music/seek.ts` — prefix + shared `handle()`
- `soul/slashCommands/music/seek.ts` — slash builder (single required `time` string option)

## Usage

```
seek <time>
/seek time:<time>
```

`<time>` is required; for the prefix variant the full remainder of the message
(`args.join(' ')`) is treated as the time string so spaces inside `1m 45s`
work without quoting.

## Time parsing — `soul/utils/parseTime.ts`

The `<time>` argument is fed to `parseTime()` which returns **milliseconds** or
throws `TimeParseError`. All formats are case-insensitive and whitespace-tolerant.

| Format | Examples |
|---|---|
| H:M:S or M:S | `1:45`, `1:30:45` |
| M.S (dot, treated like colon) | `1.45` |
| Unit-suffixed (`h`/`hr`/`hrs`/`hour`/`hours`, `m`/`min`/`mins`/`minute`/`minutes`, `s`/`sec`/`secs`/`second`/`seconds`) | `1m 45s`, `1minute 45seconds`, `1min 45sec`, `105seconds` |
| Bare integer = seconds | `120` |

### Validation rules

- **Hours**: must be `0–60` (`MAX_HM`). Out of range → `Hours must be 0-60.`
- **Minutes**: must be `0–60`. Out of range → `Minutes must be 0-60.`
- **Seconds**: **never capped**. `1m 70s`, `90s`, `1:90`, `1.90`, `120` all
  resolve correctly (e.g. `1m 70s` → 130 000 ms).
- Unit-suffixed form rejects duplicate units (`1m 2m` → `Duplicate unit "m".`)
  and unknown units (`5x` → `Unknown unit "x".`).
- Anything that doesn't match a known shape → `Invalid time format.`

Parser error messages are intentionally short. The seek command appends
`TIME_FORMAT_HELP` after every parser error so the user always sees:

> Try formats like `1m 45s`, `1:45`, `1.45`, `105s`, or `120`.

## Runtime checks (in order)

The shared `handle()` runs the following before calling Lavalink:

1. **Player + current track exist** — otherwise
   `sendError("There is nothing currently playing.")`.
2. **Not a livestream** — `current.isStream || !current.length` →
   `sendError("You can't seek inside a livestream.")`.
3. **Track is seekable** — `current.isSeekable === false` →
   `sendError("This track is not seekable.")`.
4. **Time parses** — `parseTime(rawTime)`; on `TimeParseError` →
   `sendError("<parser message>\n<TIME_FORMAT_HELP>")`. Any non-`TimeParseError`
   re-throws (defensive — the parser should never throw anything else).
5. **Position within track length** — `positionMs > current.length` →
   `sendError("Position **<HH:MM:SS>** is beyond track length (**<HH:MM:SS>**).")`.
   Both durations are formatted with `formatDuration()` from
   `soul/utils/formatting.ts`.

## Seeking

```ts
await player.seek(positionMs);
```

Kazagumo's `KazagumoPlayer.seek(position)` is **async** — it resolves once
Lavalink ACKs the update. Wrapped in `try/catch`; on failure →
`sendError("Failed to seek: <error message>")`.

## Success message

```
Seeked to **<position>** / **<track length>**.
```

Both values formatted with `formatDuration()`.

## Notes / gotchas

- Range check uses `current.length` (ms). A `0`-length track is impossible past
  the livestream check (`!current.length` already trips it).
- The slash variant calls `interaction.deferReply()` first because the seek
  RPC can take >3 s on a slow Lavalink node.
- The 2-second cooldown is intentional — Lavalink rejects rapid-fire seek
  commands on some platforms.
- No interaction with the 24/7 mode flag, the queue, or the disconnect timer
  — seeking only mutates the playhead of the current track.
