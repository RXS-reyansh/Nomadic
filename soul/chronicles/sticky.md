# Sticky Messages

Per-channel "sticky" messages that re-post themselves to the bottom of a
channel every time a new message arrives. Admin-only (`Administrator`
permission). One sticky per channel.

## Command

`$$sticky <set|enable|disable|view> [type] [body]`

| Subcommand           | Behavior                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `set <body>`         | Saves a **text** sticky for this channel and (re-)enables it. Supports `\n` escapes (real newlines) and `$emoji<name_or_id>` placeholders, identical to `say` / `note`.                                                        |
| `set text <body>`    | Same as `set <body>`, just explicit.                                                                                                                                                                                            |
| `set cv2 <json>`     | Saves a Components V2 sticky. Body must be a JSON array of component objects (each with a numeric `type`). Sent with the `IsComponentsV2` flag.                                                                                |
| `set component(s)`   | Alias for `set cv2`.                                                                                                                                                                                                            |
| `set embed <json>`   | Saves an embed sticky. Body may be a single embed object, an embeds array, or a full message-shaped `{content, embeds}` object.                                                                                                |
| `enable`             | Re-enables a disabled sticky and immediately re-posts it. If the sticky is already enabled, sends an info message.                                                                                                              |
| `disable`            | Pauses a sticky (config kept). Removes the currently-displayed sticky from the channel. If already disabled, sends an info message.                                                                                             |
| `view`               | Shows the stored type, status, and raw payload in a code block.                                                                                                                                                                 |

## Storage

Collection `sticky_messages` (bot-prefixed):

```js
{
  guild_id:        string,
  channel_id:      string,
  type:            'text' | 'cv2' | 'embed',
  payload:         string,           // raw text or JSON string
  enabled:         boolean,
  last_message_id: string | null,    // most recent sticky message we sent
  updated_at:      Date,
}
```

## Update flow

For every guild message, `messageCreate` calls `updateSticky(client, message)`
from `soul/helpers/stickyHelper.ts`. The helper:

1. Checks the in-memory `client.stickyMessages` cache
   (`Map<"<guildId>-<channelId>", lastMessageId>`) and bails if the incoming
   message IS the bot's own most recent sticky.
2. Acquires a per-channel lock (`updatingLocks` Set) — prevents bursts from
   stacking re-posts. The lock is released after a 200 ms cooldown to
   coalesce rapid traffic.
3. Loads the sticky config from MongoDB. Bails if missing or `enabled === false`.
4. Loads the prior sticky message (cached id ?? `last_message_id`) and deletes
   it.
5. Posts the new sticky via `postStickyToChannel`, which:
   - Builds the right send-payload via `buildStickyPayload` (sets
     `IsComponentsV2` flag for `cv2`, dispatches embed shapes correctly).
   - Updates both the in-memory cache and the DB `last_message_id`.

## Differences vs the JS reference

- Three sticky types (`text`, `cv2`, `embed`) instead of just text.
- `enable` / `disable` (preserve config) instead of `remove` (destroys it).
- `setStickyAndPost` wipes the previous sticky before posting the new one so
  `set` never leaves an orphan.
- DB layer normalises field names (`guild_id`, `channel_id`, `last_message_id`,
  `updated_at`) to match every other collection in the project.
- Loop guard runs against the in-memory cache *and* the persisted
  `last_message_id`, so the very first message after a restart cannot trigger
  a duplicate post.
- `Administrator` permission required (set in command options + re-checked at
  runtime).
