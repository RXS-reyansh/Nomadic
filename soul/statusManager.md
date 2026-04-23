# Status Manager

Per-bot presence / Custom Status / device-icon driver. Single source of truth
lives in `soul/config/botInstances.ts`; the engine lives in
`soul/structures/StatusManager.ts`.

## Configuration

`soul/config/botInstances.ts` exports:

- `ROTATION_INTERVAL_MS` — how long (ms) the manager waits between entries
  when `rotation === 'multi'`. Default: `30_000` (30 s).
- `botInstances: BotInstance[]` — one entry per bot you might run.
- `findBotInstanceByClientId(id)` — helper consumed by `HermacaClient` and
  `StatusManager`.

```ts
interface BotInstance {
  buildName:     string;                 // e.g. "Nomadic", "BETA version of Nomadic"
  clientId:      string;                 // matched against process.env.DISCORD_CLIENT_ID
  name:          string;                 // shown under the [STATUS] log tag at startup
  displayStatus: 'online' | 'idle' | 'dnd' | 'invisible' | 'mobile';
  mode:          'presence' | 'status';  // activity vs Custom Status
  rotation:      'single' | 'multi';     // single = first entry only; multi = cycle
  entries:       StatusEntry[];
}

interface StatusEntry {
  text:          string;            // required
  emoji?:        string;            // status mode only — prepended to text
  activityType?: 'Playing' | 'Listening' | 'Watching' | 'Competing' | 'Streaming' | 'Custom';
  streamUrl?:    string;            // required when activityType === 'Streaming'
}
```

`text` supports three runtime placeholders: `{guilds}`, `{users}`,
`{botName}`.

## Modes

- `mode: 'presence'` — uses `entry.activityType` (`Playing` / `Listening` /
  `Watching` / `Competing` / `Streaming` / `Custom`). For `Streaming` you must
  provide a valid Twitch URL via `streamUrl`.
- `mode: 'status'` — sets a Custom Status (Discord activity type 4). The
  visible line is `${emoji} ${text}` (emoji is optional).

## Rotation

- `rotation: 'single'` — `entries[0]` is applied once at startup, never again.
- `rotation: 'multi'` — applies `entries[0]`, then every
  `ROTATION_INTERVAL_MS` advances to the next entry, looping back to the
  start when it reaches the end. Logged with `slot N/M` per swap.

## The mobile device icon

`displayStatus: 'mobile'` makes the bot show up with the green phone icon
next to its name. Discord exposes this purely through the **gateway IDENTIFY
browser property** — once the websocket has identified, the device indicator
cannot be changed mid-session.

`HermacaClient`'s constructor handles this: right after `super()`, before
`client.login()` is ever called, it looks up the matched instance by
`process.env.DISCORD_CLIENT_ID`. If `displayStatus === 'mobile'` it rewrites
`client.ws.options.identifyProperties` to:

```
{ browser: 'Discord Android', os: 'android', device: 'discord-android' }
```

Under the hood the actual gateway status sent for `mobile` is `online`
(`StatusManager.toGatewayStatus`) — Discord requires online/idle/dnd/invisible
for the status pill, and `mobile` is just the device hint.

## Lifecycle

1. `HermacaClient` constructor — installs mobile identify properties if the
   matched instance asks for them.
2. `ready.ts` — instantiates `client.statusManager = new StatusManager(...)`,
   then calls `start()`.
3. `start()` logs `Using "<name>" instance config (build: <buildName>)` under
   the `[STATUS]` tag, applies entry 0, and (if `multi`) schedules an
   interval that rotates through the remaining entries.
4. If no instance matches the running clientId, the legacy
   `config.defaultPresence` is applied as a fallback.

## Adding / changing an entry

Edit `soul/config/botInstances.ts` only. Restart the bot for the change to
take effect. No other file needs to be touched.
