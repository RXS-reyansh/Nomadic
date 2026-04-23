# Hermaca Command Audit Notes

Scope: notes only. No source code was changed for this review.

Checked areas:
- Prefix commands in `soul/commands/`
- Slash command builders in `soul/slashCommands/`
- Command loading and validation flow
- Discord message/interaction event flow
- AFK, no-prefix, blacklist, utility, customisation, info, and music command behavior
- Current workflow startup state

## Current Bot Working Status

- The configured workflow runs `npm run build && npm start`.
- TypeScript build currently passes.
- Runtime startup currently stops at:
  - `DISCORD_TOKEN environment variable is not set`
- Because the token is missing, the bot cannot fully log in, register slash commands, connect to Discord, join voice channels, or verify live Discord behavior in this environment.
- No compile-time blockers were visible during the workflow check.

## Command Ideas Based on What Exists Now

### AFK
- Add `afk status [user]` to show whether a user is server/global AFK, their reason, image, and duration.
- Add `afk clear` so users can manually remove AFK without sending a normal message.
- Add `afk list` for admins/developers to see AFK users in the current server.
- Add `afk edit <reason>` to update an existing AFK without clearing/reconfirming.
- Add AFK ignore options for channels, roles, or users so mention notices do not spam certain channels.

### No-Prefix
- Add `noprefix status` to show global state, server state, and whether a given user has no-prefix access.
- Add `noprefix sync` or `noprefix prune` to remove users that can no longer be fetched.
- Add pagination to the no-prefix list if it grows too large.
- Add audit metadata in list views: who added a user and when.

### Blacklist
- Add `blacklist status [user]` and `blacklist-server status [server]`.
- Add optional blacklist reasons stored in MongoDB.
- Add expiry-based temporary blacklist: `blacklist add @user 7d reason`.
- Add blacklist export/import for backup.
- Add a single moderation overview command showing blacklist, server blacklist, no-prefix, and AFK counts.

### Avatar / Banner
- Add avatar/banner history if users request previously seen assets.
- Add `avatar compare @user1 @user2` for side-by-side panels.
- Add server-only/global-only direct subcommands to skip the choice prompt.

### Emoji / React / Say
- Add `emoji info <emoji>` to show name, ID, animated/static, and source guild if available.
- Add `say preview` or confirmation for developer say messages before sending.
- Add `react remove` to remove the bot's reaction from a target message.

### Music
- Add `queue`, `clearqueue`, `remove <position>`, `move <from> <to>`, and `shuffle`.
- Add `volume` because the database already appears to have volume-related support.
- Add `lyrics` because the database already has lyrics cache helpers.
- Add `search` command that shows top results and lets the user choose.
- Add `247` / `stay` user-facing command if 24/7 behavior is intended to be public.

### Help / Info
- Add command examples in help command detail pages.
- Add aliases search in help: `help p` should clearly resolve to `play`.
- Add `botinfo`, `serverinfo`, and `userinfo` using existing resolver patterns.

## Loopholes / Abuse Risks / Weak Spots

### 1. AFK can create database work on every normal message
Every guild message currently runs AFK removal logic before command detection. This is expected behavior, but it means every normal message can cause DB access. In busy servers this may become expensive.

Possible future improvement: cache active AFK user IDs in memory, or only query DB if the author/mentioned/replied user is known to be AFK.

### 4. AFK slash command may not defer before reply
The AFK slash command replies directly with the confirmation payload. This is fine if parsing is fast. However, emoji resolution can fetch emojis across guilds, which may make the command take too long in large bots and risk Discord’s interaction timeout.

Possible future improvement: defer slash AFK replies before expensive emoji parsing, or keep emoji parsing fully cache-first.

### 5. AFK image URL accepts any trailing HTTP URL
Prefix AFK treats the final `http(s)://...` token as an image URL if no attachment exists. It does not verify that the URL is actually an image.

Potential odd output: a normal link at the end of the reason may be removed from the text and displayed as an image/media component, even if it is not an image.

### 6. AFK developer timestamp can spoof long durations
Developers can provide a trailing Discord timestamp to set custom since/till behavior. That is intended, but it means a developer can display fake “away for years” style durations.

### 7. User blacklist applies only after command detection
Blacklisted users are blocked after the bot confirms the message is a command. This is good for silence on random messages, but means blacklisted users can still trigger some pre-command logic such as AFK removal and AFK mention checks.

### 8. Server blacklist is mostly enforced by leaving guilds, not every message
Server blacklist is enforced on guild join and ready startup, and when adding a currently joined server. There is no direct server-blacklist check inside `messageCreate` or `interactionCreate` before command execution.

If the bot fails to leave for permissions/API/transient reasons, or if blacklist settings change while the bot remains in the guild, commands could still process until leave enforcement runs successfully.

### 9. Developer commands can affect the current server by omission
`blacklist-server` with no args blacklists the current server. This is documented, but it is powerful and easy to trigger accidentally by a developer.

Possible future improvement: require confirmation for destructive server-level actions.

### 10. Attachment fetching can be abused
`say` downloads attachments into memory with `fetch` and `Buffer.from`. Large files can consume memory. There is no explicit file size or MIME validation.

### 11. Emoji resolution can be expensive
Emoji resolution may search/fetch across many guilds. Commands like `emoji`, `say`, and `afk` can become slow or rate-limited if many unknown emoji names are supplied.

### 12. Plain fallback error messages still exist
Most messages use Components V2, but generic command/slash catch blocks still use plain content strings such as “An error occurred.” This is not a user-facing command feature, but it violates the all-Components-V2 preference if those paths are triggered.

### 13. Welcome message in `guildCreate` is plain text
The guild join welcome message is sent as plain content. This is outside command output, but still a bot message that does not use Components V2.

## Specific Argument / Usage Conditions That May Produce Unexpected Output

### AFK
1. `afk I am reading https://example.com/page`
   - The trailing URL becomes `imageUrl` and is removed from the reason.
   - If the URL is not image-compatible, the media gallery may not render as intended.

2. `afk https://example.com/image.png`
   - Reason becomes `Reason not provided.` and the URL becomes the AFK image.
   - This may be expected, but some users may expect the URL to be the reason text.

3. `afk reason $emoji<unknown>`
   - The entire AFK setup returns an invalid emoji error and does not show confirmation.

4. `afk reason <t:1234567890:R>` by a non-developer
   - The timestamp remains part of the reason instead of being interpreted.
   - This is intended by permissions, but may confuse non-developers.

5. `afk reason <t:9999999999:R>` by a developer
   - Since the time is in the future, it becomes `tillAt` rather than `sinceAt`.
   - The user may expect it to be the start time if they do not understand the future/past split.

6. Prefix AFK with multiple attachments
   - Only the first attachment is considered.

7. Setting both server AFK and global AFK
   - Both can exist at once. Sending a message in that server removes both because removal deletes global plus matching server AFK.
   - Sending a message in another server removes only global AFK.

8. Mentioning a user who has both server and global AFK
   - Server AFK wins because `getAFK` checks server first.

### No-Prefix
1. `noprefix add username with spaces`
   - The resolver receives all text after `add`, which is good, but ambiguous usernames may resolve unexpectedly depending on resolver behavior.

2. `noprefix server enable not-a-server-id`
   - Returns invalid server ID.

3. `noprefix server enable` in a server
   - Uses the current guild ID because no server ID is provided.
   - This is useful but could surprise developers who expected an explicit ID requirement.

4. `noprefix list` with many users
   - The component may become too large for Discord component/text limits.

5. A no-prefix user sends a normal message beginning with a command name
   - It will execute as a command even without the global prefix if no-prefix conditions pass.
   - Example: saying `play something` casually will trigger music playback.

### Blacklist
1. `blacklist add username with spaces`
   - Same resolver ambiguity risk as no-prefix.

2. `blacklist add @developer`
   - Nothing in the command appears to prevent blacklisting a developer.
   - However, developers may still bypass some systems depending on later checks; this should be clarified in intended policy.

3. `blacklist-server` with no arguments
   - Immediately adds the current server to server blacklist and may make the bot leave if global server blacklist is enabled.

4. `blacklist-server add 123`
   - Rejected because IDs must be 17-20 digits.

5. `blacklist list` with many users or `blacklist-server list` with many servers
   - The list component may exceed Discord message/component size limits.

### Avatar / Banner
1. `avatar server` in a server without icon
   - Correctly returns an error.

2. `banner server` in a server without banner
   - Correctly returns an error.

3. `avatar <username>` where multiple users have the same username/display name
   - Resolver may pick an unexpected user depending on resolver implementation.

4. Choice prompt timeout
   - Choice buttons disable after timeout, but if the message was deleted or permissions changed, the edit silently fails.

5. DM button on image panel
   - If user DMs are closed, the bot uses an ephemeral follow-up for interaction button. This should work for component interactions, but failures are swallowed.

### Emoji
1. `emoji name1 |$| name2`
   - Spaces around `|$|` break the no-space separator behavior because input is split by whitespace first.

2. `emoji unknown knownEmoji`
   - Sends the known emoji and separately sends an invalid-list error.
   - This is logical, but users may not expect partial success.

3. A very long list of emoji names
   - Can trigger many resolver calls and potentially exceed Discord message length.

### Say
1. `say` with a huge attachment
   - Bot downloads attachment into memory, which can be risky.

2. `say $emoji<unknown>`
   - Invalid emojis are removed from output and an error message is sent after.

3. Prefix `say` as a reply
   - Bot deletes the command message and replies to the target. If delete permission is missing, command message remains.

4. Slash `say` with no text but attachment
   - Sends the attachment, then sends success. This is expected.

### React
1. Prefix `react <emoji>` without replying
   - Reacts to the previous message in the channel. If the previous message is the command itself or fetch order differs, it may target an unexpected message.

2. Slash `react` with a message ID from another channel
   - Fails because it fetches only from the current channel.

3. Unknown custom emoji name
   - Returns “Emoji not found,” but resolution may do expensive guild-wide fetches first.

### Music
1. `play <query>` with no Lavalink/Riffy connection available
   - Likely fails during resolve/create connection. Error handling exists for resolve, but not every playback/connection failure path is user-friendly.

2. `skipto 1`
   - Position 1 is accepted, splices zero queue items, then stops the player. This may restart/advance behavior unexpectedly and is not very useful.

3. `skipto 1.5`
   - Prefix path uses `parseInt`, so this becomes `1` rather than invalid.

4. `skipto 2abc`
   - Prefix path uses `parseInt`, so this becomes `2` rather than invalid.

5. Slash `skipto` uses integer option, so it is stricter than prefix behavior.

6. `play` with a playlist containing many tracks
   - Adds all tracks. Large playlists may create large queue/memory usage.

### Customisation
1. URL-based avatar/banner changes
   - If a URL points to an invalid image, huge image, or unsupported format, REST/base64 handling may fail.

2. `setbio` with very long text
   - There is a documented 190-character limit, but users may include escaped newlines that alter final length after parsing.

3. Bot role/permission edge cases
   - Even if command validation passes, Discord REST may reject profile/nickname changes depending on guild/role state.

### Help
1. Developer commands are hidden from help by category, which is intended.
2. If a command has aliases and a user runs `help <alias>`, behavior depends on the help lookup implementation.
3. Inactivity timeout edits may fail silently if the message is deleted.

## Main Running-Code Ideas

### 1. Add a startup health report
At startup, log a clear checklist:
- Discord token present
- Client ID present
- Mongo URI present
- Lavalink nodes configured
- Slash registration attempted/succeeded
- Prefix/slash command counts
- Event/helper counts

### 2. Centralize runtime error responses
Replace plain catch-block responses with a shared Components V2 error helper so all unexpected command errors match the bot’s UI standard.

### 3. Add command execution telemetry
Track command success/failure counts, average duration, and failures by command. This can help identify slow commands like emoji resolution or music search.

### 4. Add database availability guard
Provide a central helper for commands/events that need MongoDB. If DB is down, return a consistent Components V2 error instead of failing deeper in the command.

### 5. Add rate limiting for expensive utilities
Add per-user and per-guild rate limits for:
- AFK mention notices
- emoji resolution
- say with attachments
- avatar/banner API fetches
- play/search requests

### 6. Add safe attachment handling
Use size checks, content-type checks, and streaming where possible. Avoid loading arbitrary large files fully into memory.

### 7. Add batch DB queries for messageCreate
For AFK mention checks, fetch all mentioned/replied user AFK rows in one query instead of one query per user.

### 8. Add in-memory cache for low-risk settings
Cache frequently-read settings such as:
- no-prefix global enabled
- no-prefix users
- disabled no-prefix guilds
- blacklist global enabled
- blacklisted users/servers
- active AFK IDs

Use short TTLs or update cache immediately when developer commands change settings.

### 9. Improve server blacklist enforcement
Add a direct guard in `messageCreate` and `interactionCreate` that blocks commands in blacklisted guilds even if the bot has not left yet.

### 10. Add command argument strictness helpers
Use reusable parsers for IDs, integers, URLs, durations, and user resolution. This would prevent prefix/slash mismatch cases like `skipto 2abc` being accepted in prefix but impossible in slash.

### 11. Add safer destructive command confirmations
Require confirmation buttons for destructive/developer actions such as:
- blacklisting current server
- globally disabling blacklist/no-prefix
- clearing queues
- resetting bot profile

### 12. Add pagination helpers
Reusable Components V2 pagination would help:
- blacklist list
- blacklist-server list
- no-prefix list
- future queue command
- AFK list

## Highest Priority Issues To Consider Later

1. Add server blacklist guard directly to command events.
2. Add AFK notice cooldown to prevent spam.
3. Add strict integer parsing for prefix commands like `skipto`.
4. Add size/type limits for attachment downloads in `say` and customisation commands.
5. Convert remaining plain text fallback messages to Components V2.
6. Add pagination for all growing database-backed lists.
7. Cache or batch DB lookups in `messageCreate` to reduce per-message overhead.
