# Riffy → Kazagumo + Shoukaku Migration

## Status
Migration in progress. Use this document if the migration is incomplete.

## Packages
- **Remove:** `riffy`, `riffy-spotify`
- **Add:** `kazagumo`, `shoukaku`
- Run: `npm uninstall riffy riffy-spotify && npm install kazagumo shoukaku`

## Core API Differences

### Client field
- Old: `client.riffy` (Riffy instance)
- New: `client.kazagumo` (Kazagumo instance)

### Initialisation (`HermacaClient.ts`)
```typescript
import { Kazagumo } from 'kazagumo';
import { Connectors } from 'shoukaku';

this.kazagumo = new Kazagumo(
  { defaultSearchengine: 'ytsearch' },
  new Connectors.DiscordJS(this),          // handles voice state automatically — no raw event needed
  config.nodes.map(n => ({
    name: n.name,
    url: `${n.host}:${n.port}`,
    auth: n.auth,
    secure: n.secure || false,
  })),
);
```

### `raw.ts` event — no longer needed
The `Connectors.DiscordJS` connector handles voice state packet forwarding automatically.
The `raw.ts` file should be a no-op (or deleted).

### Player creation
```typescript
// Old
const player = client.riffy.createConnection({ guildId, voiceChannel, textChannel, deaf });
// New (async!)
const player = await client.kazagumo.createPlayer({ guildId, voiceId, textId, deaf, volume: 100 });
```

### Player properties renamed
| Riffy | Kazagumo |
|---|---|
| `player.voiceChannel` | `player.voiceId` |
| `player.textChannel` | `player.textId` |
| `player.current` | `player.queue.current` |
| `player.queue.length` | `player.queue.length` (same, KazagumoQueue extends Array) |

### Player methods changed
| Riffy | Kazagumo |
|---|---|
| `player.pause(true)` | `player.pause()` |
| `player.pause(false)` | `player.resume()` |
| `player.stop()` (skip to next) | `player.skip()` |
| `player.stop()` + `player.disconnect()` | `player.queue.clear(); await player.destroy()` |

### Search / resolve
```typescript
// Old
const result = await client.riffy.resolve({ query, requester: user });
// result.loadType: 'playlist' | 'empty' | 'error' | 'track' | 'search'
// result.playlistInfo.name

// New
const result = await client.kazagumo.search(query, { requester: user });
// result.type: 'PLAYLIST' | 'EMPTY' | 'ERROR' | 'TRACK' | 'SEARCH'
// result.playlistName
```

### Track data shape — no .info wrapper
```typescript
// Old: track.info.title / track.info.author / track.info.uri / track.info.length
//      track.info.sourceName / track.info.requester / track.info.identifier
// New: track.title / track.author / track.uri / track.length
//      track.sourceName / track.requester / track.identifier / track.thumbnail
```

### Custom player data (autoplay, previousTracks)
Riffy allowed arbitrary properties directly on the player. In Kazagumo use `player.data` (a Map):
```typescript
// Old: player.isAutoplay / player.previousTracks
// New: player.data.get('isAutoplay') / player.data.get('previousTracks')
//      player.data.set('isAutoplay', true)  etc.
```

---

## Event Loader Changes (`eventLoader.ts`)
- `type === 'player'` events → attach to `client.kazagumo`
- `type === 'node'` events → attach to `client.kazagumo.shoukaku`

## Event Name Mapping

### Player events (`soul/events/player/`)
| File | Old name | New name |
|---|---|---|
| `trackStart.ts` | `trackStart` | `playerStart` |
| `trackEnd.ts` | `trackEnd` | `playerEnd` |
| `queueEnd.ts` | `queueEnd` | `playerEmpty` |
| `trackError.ts` | `trackError` | `playerException` |
| `trackStuck.ts` | `trackStuck` | `playerStuck` |
| `playerCreate.ts` | `playerCreate` | `playerCreate` (unchanged) |
| `playerDisconnect.ts` | `playerDisconnect` | `playerDestroy` |
| `playerMove.ts` | `playerMove` | `playerMoved` |
| `playerUpdate.ts` | `playerUpdate` | `playerUpdate` (unchanged) |
| `socketClosed.ts` | `socketClosed` | `playerClosed` |
| `debug.ts` | `debug` (player) | `debug` (node, attach to shoukaku) |

### Kazagumo player event argument shapes
- `playerStart(player, track)` — track has flat props (no .info)
- `playerEnd(player, track)` — same
- `playerEmpty(player)` — no track arg
- `playerException(player, data)` — no track arg, get from `player.queue.current`
- `playerStuck(player, data)` — no track arg, get from `player.queue.current`
- `playerCreate(player)` — unchanged
- `playerDestroy(player)` — unchanged
- `playerMoved(player, state, channels)` — channels: `{ oldChannel, newChannel }`
- `playerUpdate(player, data)` — data.state.position for position
- `playerClosed(player, data)` — data has code/reason

### Node events (`soul/events/node/`) — attach to `client.kazagumo.shoukaku`
| File | Old name | New Shoukaku name | Args |
|---|---|---|---|
| `nodeConnect.ts` | `nodeConnect` | `ready` | `(name: string, resumed: boolean)` |
| `nodeCreate.ts` | `nodeCreate` | *(no Shoukaku equivalent — silent no-op)* | — |
| `nodeDisconnect.ts` | `nodeDisconnect` | `disconnect` | `(name: string, players: any[], moved: boolean)` |
| `nodeDestroy.ts` | `nodeDestroy` | `close` | `(name: string, code: number, reason: string)` |
| `nodeError.ts` | `nodeError` | `error` | `(name: string, error: Error)` |
| `nodeReconnect.ts` | `nodeReconnect` | *(no Shoukaku equivalent — silent no-op)* | — |

---

## Files Changed

### Critical (must complete first)
- [x] `package.json` — dependency swap
- [x] `soul/structures/HermacaClient.ts` — Kazagumo init
- [x] `soul/handlers/eventLoader.ts` — split node vs player event targets
- [x] `soul/handlers/commandValidator.ts` — client.kazagumo refs
- [x] `soul/handlers/helperLoader.ts` — player API changes

### Discord events
- [x] `soul/events/discord/raw.ts` — no-op (connector handles it)
- [x] `soul/events/discord/voiceStateUpdate.ts` — client.kazagumo + player.voiceId
- [x] `soul/events/discord/guildDelete.ts` — client.kazagumo
- [x] `soul/events/discord/ready.ts` — remove riffy.init()

### Node events
- [x] `soul/events/node/nodeConnect.ts`
- [x] `soul/events/node/nodeCreate.ts`
- [x] `soul/events/node/nodeDisconnect.ts`
- [x] `soul/events/node/nodeDestroy.ts`
- [x] `soul/events/node/nodeError.ts`
- [x] `soul/events/node/nodeReconnect.ts`

### Player events
- [x] `soul/events/player/trackStart.ts`
- [x] `soul/events/player/trackEnd.ts`
- [x] `soul/events/player/queueEnd.ts`
- [x] `soul/events/player/trackError.ts`
- [x] `soul/events/player/trackStuck.ts`
- [x] `soul/events/player/playerCreate.ts`
- [x] `soul/events/player/playerDisconnect.ts`
- [x] `soul/events/player/playerMove.ts`
- [x] `soul/events/player/playerUpdate.ts`
- [x] `soul/events/player/socketClosed.ts`
- [x] `soul/events/player/debug.ts`

### Music commands
- [x] `soul/commands/music/play.ts`
- [x] `soul/commands/music/skip.ts`
- [x] `soul/commands/music/skipto.ts`
- [x] `soul/commands/music/stop.ts`
- [x] `soul/commands/music/pause.ts`
- [x] `soul/commands/music/resume.ts`
- [x] `soul/commands/music/nowplaying.ts`
- [x] `soul/commands/music/peek.ts`

### VC control commands
- [x] `soul/commands/vcControls/join.ts`
- [x] `soul/commands/vcControls/leave.ts`
- [x] `soul/commands/vcControls/rejoin.ts`

### Helpers & components
- [x] `soul/helpers/nowPlayingManager.ts`
- [x] `soul/helpers/debugStats.ts`
- [x] `soul/commands/info/ping.ts`
- [x] `soul/components/nowPlaying.ts`

## Spotify Support
`riffy-spotify` is removed. Lavalink servers with the **LavaSrc** plugin support Spotify natively
(no client-side plugin needed). If Spotify support breaks, check that the Lavalink node has
LavaSrc installed. Alternatively, add the `kazagumo-spotify` npm package and register it as a
plugin.
