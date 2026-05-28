# Commands That Still Need a Slash Counterpart

A snapshot of every prefix command that has **no** `/slash` equivalent and
*should* eventually get one. Developer commands are intentionally excluded —
they are deliberately prefix-only because a slash variant would expose
owner-only tooling to every server's slash picker (see `replit.md` →
"Developer" section).

> Total: **2** prefix-only commands across 1 category.

---

## Utility (2) — `soul/commands/utility/`

These two commands need raw message context that slash interactions either
cannot supply or supply in a degraded form.

| Command  | Reason no slash version exists                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `steal`  | Designed to be invoked while replying to a message containing emojis/stickers. Slash commands have no `messageReference` so the "reply to grab" flow is impossible.                       |
| `sticky` | Sets a sticky message in the channel — body content is read from the prefix-message body, often multi-line and rich (raw `\n`, `$emoji<…>` placeholders, JSON for `cv2` / `embed` types). Slash command's single string option mangles formatting. |

---

## Quick reference — coverage after this pass

The following categories now have **full slash coverage**:

- **Music** — every command (20 total).
- **Customisation** — every command (7 total).
- **Info** — `help`, `ping`, `debug` (3 total).
- **VC Controls** — `join`, `leave`, `disconnect`, `rejoin`, `shift`, `mute`, `unmute`, `deafen`, `undeafen` (9 total).
- **Utility** — `afk`, `avatar`, `banner`, `react`, `membercount`, `purge`, `purge-till`, `serverpurge` (8 of 10).

Only `steal` and `sticky` remain prefix-only outside of the developer category.

---

*Last updated: VC controls + utility purge/membercount slash pass — added
slash builders in `soul/slashCommands/vcControls/` and the four missing
utility builders in `soul/slashCommands/utility/`. Each prefix file now
factors its core logic into a shared `handle()` (or `runFilteredDelete` /
`runLinkDelete` / `runServerPurge`) helper so prefix and slash never drift.*
