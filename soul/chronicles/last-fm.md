# Last.fm Integration — Possibility Brief

This is an **idea brief**, not a spec. Pick the commands you want; I'll write a
proper spec (in `soul/chronicles/last-fm.md`) once you've narrowed the list.

---

## Why Last.fm is a much better fit than Spotify for "stats" features

Where Spotify locks every interesting metric (top tracks, recently played,
currently playing, minutes listened) behind a per-user OAuth flow, **Last.fm
gives almost all of it away with just an API key and a public username**. No
per-user consent, no callback URL, no refresh tokens. The Last.fm Web Services
treat any public profile's scrobble history as fair game.

What that means for us:
- The user just runs `linklastfm <username>` once. We store
  `{ discord_id, lastfm_username, linked_at }`. Done. No browser flow.
- Every "stats"-style command works immediately for any linked user.
- Optional: a full Last.fm OAuth (session-key) flow for **write** actions like
  scrobbling, loving/unloving tracks, etc. — only needed if we ever want to
  push data *to* Last.fm.

---

## How to connect a Last.fm profile (three options, easiest first)

1. **Username only (recommended for v1).** `linklastfm <username>` — we store
   it, validate it via `user.getInfo`, done. Covers every read command below.
2. **Username + verification** (overkill for v1). Make the user paste a code
   into their Last.fm bio so we can prove they own the account. Last.fm has no
   built-in mechanism for this, so it'd be DIY.
3. **Full OAuth (session key).** Required only for *writes* (scrobble, love,
   unlove). Web flow: redirect to `https://www.last.fm/api/auth/?api_key=…&cb=…`,
   exchange the returned `token` for a permanent session key via `auth.getSession`,
   store the session key. Needs a public callback URL (Replit deploy is fine).

Recommendation: ship username-only linking first. Add OAuth only if/when we
build write commands.

---

## What we'd need to add (one-time setup)

- Env vars: `LASTFM_API_KEY`, `LASTFM_SHARED_SECRET` (only needed for OAuth/writes).
- New category folder: `soul/commands/lastfm/` + matching `soul/slashCommands/lastfm/`.
- New entry in `soul/config/categories.ts` (`name: 'lastfm', displayName: 'Last.fm'`).
- DB collection `lastfm_links`: `{ user_id, lastfm_username, session_key?, linked_at }`
  with `linkLastfm` / `unlinkLastfm` / `getLastfmUsername` / `setLastfmSession` methods,
  modeled on the existing AFK/prefix code in `soul/database/database.ts`.
- A tiny `soul/helpers/lastfmClient.ts` wrapper around `fetch` (Last.fm uses a
  single GET endpoint with `?method=…` so a hand-rolled wrapper is ~40 lines —
  no npm package needed).
- New components in `soul/components/` for the panels (profile card, scrobble
  list, top-N list, charts, etc.). All Components V2, same conventions as
  `helpMenu.ts` / `queueMenu.ts`.

---

## Command suggestions

Naming is suggestion-only. Each has the API method it would use in `[brackets]`
so you can see what's actually feasible.

### Account linking (must have)
- **`linklastfm <username>`** — Save the username after validating with
  `[user.getInfo]`. Errors if username doesn't exist or user already linked.
- **`unlinklastfm`** — Remove the link.
- **`lastfmwhois [@user]`** — Show which Last.fm account someone's Discord
  account is linked to (or "not linked").

### Profile & identity
- **`fmprofile [@user]`** — Profile card: real name, country, age, avatar,
  registered date, total playcount, total scrobble count, "playing now" if
  currently scrobbling, link to profile. `[user.getInfo]`
- **`fmavatar [@user]`** — Just their Last.fm avatar in a clean panel.
  Niche but cheap. `[user.getInfo]`

### Now playing / recent activity
- **`fm [@user]`** (alias `np`/`nowscrobbling`) — The classic Last.fm bot
  command: shows what they're scrobbling right now (or their most recent
  scrobble if nothing live), with album art, "X plays of this track", and a
  link. **The single most-used Last.fm bot command in existence.**
  `[user.getRecentTracks limit=1 + track.getInfo username=…]`
- **`fmrecent [@user] [n]`** — Last N scrobbles (paginated, default 10, max 50
  per page). `[user.getRecentTracks]`
- **`fmlast [@user]`** — Compact one-liner: `Last scrobble: Artist - Track
  (2h ago)`. Different vibe to `fm` — useful for quick checks.

### Top charts (per period)
All take an optional period: `7day` (default), `1month`, `3month`, `6month`,
`12month`, `overall`. All are paginated.
- **`fmtopartists [@user] [period] [limit]`** — `[user.getTopArtists]`
- **`fmtopalbums  [@user] [period] [limit]`** — `[user.getTopAlbums]`
- **`fmtoptracks  [@user] [period] [limit]`** — `[user.getTopTracks]`
- **`fmtoptags    [@user] [limit]`** — Their personally-applied tags + counts.
  `[user.getTopTags]`
- **`fmweekly     [@user] [type]`** — Weekly top 10 of artists/albums/tracks.
  `[user.getWeekly{Artist,Album,Track}Chart]`
- **`fmyearly     [@user]`** — A "year-in-review" style summary card built
  from the `12month` period across all three top-* endpoints, formatted into
  one Components V2 panel. **Great as a flagship feature.**

### Loved tracks & social
- **`fmloved [@user] [limit]`** — Their Last.fm-loved tracks.
  `[user.getLovedTracks]`
- **`fmfriends [@user]`** — Show their Last.fm friends list (separate from
  Discord). `[user.getFriends]`

### Track / artist / album lookup (no link required)
These work for *any* artist/track/album, not tied to a user.
- **`fmtrack <artist> - <track>`** — Track info card: total listeners, total
  scrobbles, top tags, similar tracks, wiki summary.
  `[track.getInfo + track.getSimilar]`
- **`fmartist <artist>`** — Artist info card: bio, top tracks, top albums,
  similar artists, listener count. `[artist.getInfo + artist.getTopTracks +
  artist.getSimilar]`
- **`fmalbum <artist> - <album>`** — Album info card: tracklist, listener
  count, top tags, wiki. `[album.getInfo]`
- **`fmsimilar <artist>`** — "If you like X, try Y/Z/…". Works without a
  linked account. `[artist.getSimilar]`
- **`fmtag <tag>`** — Genre/tag explorer: top artists, top tracks, top albums
  for that tag. `[tag.getTopArtists + tag.getTopTracks + tag.getTopAlbums]`

### Comparison & social-in-server
These pull two or more linked users in a single panel.
- **`fmtaste @user1 [@user2]`** — Compatibility score between two linked users
  based on overlapping top artists. We'd compute the % ourselves from
  `[user.getTopArtists]` for both users.
- **`fmcommon @user`** — Artists/tracks both you and them have in common.
- **`fmwhoknows <artist>`** — Across all linked users in the current guild,
  who has the highest playcount of `<artist>`. **Killer feature — this is
  what the .fmbot Discord bot is famous for.**
  `[artist.getInfo username=… per linked guild member]` (one call per user).
- **`fmwhoknowsalbum <artist> - <album>`** — Same idea for an album.
  `[album.getInfo username=…]`
- **`fmwhoknowstrack <artist> - <track>`** — Same idea for a track.
  `[track.getInfo username=…]`
- **`fmcrowns [@user]`** — How many "crowns" (= server-wide #1 spots) a user
  holds. Computed locally from cached whoknows data.
- **`fmleaderboard [period]`** — Top scrobblers in this guild this period.
  Iterates linked guild members and ranks by `[user.getInfo].playcount`.

### Discovery / "what should I play"
- **`fmrecommend [@user]`** — Pull their top artists, then `artist.getSimilar`
  on each, then dedup → recommend N artists they probably haven't heard.
- **`fmplay [@user]`** — Take their *current* `fm` scrobble and play it
  through the existing `unifiedSearch` → Lavalink pipeline. So `$$fmplay
  @friend` literally plays whatever they're listening to in your VC. Hooks
  cleanly into `play.ts`'s flow.
- **`fmplaytop [@user] [period]`** — Queue their top 10 tracks for the period.

### Charts (global, no link required)
- **`fmcharts tracks|artists|tags`** — Last.fm's global top-of-the-moment.
  `[chart.getTopTracks / chart.getTopArtists / chart.getTopTags]`
- **`fmgeo <country> [tracks|artists]`** — Top tracks/artists in a country.
  `[geo.getTopTracks / geo.getTopArtists]`

### Charts as image (stretch)
- **`fmchart <NxN> [period]`** — Generate a 3x3 / 4x4 / 5x5 album-art collage
  of their top albums for the period and ship it as a single image. Needs a
  bit of canvas/sharp work but all the data is one `user.getTopAlbums` call.
  Hugely shareable feature — every Last.fm Discord bot has this.

### Write actions (only if we add OAuth later)
- **`fmlove`** — Love whatever's currently playing in the bot.
  `[track.love]` *(needs session key)*
- **`fmunlove`** — Opposite. *(needs session key)*
- **`fmscrobble`** — Manually scrobble a track. `[track.scrobble]`
  *(needs session key)*
- **`fmautoscrobble on/off`** — When the bot plays a track in your VC and
  you're listening, scrobble it for you. *(needs session key per user)*

---

## Suggested rollout phases

If you want a cheat sheet of "what to build first":

1. **Phase 1 — wiring + the classics.** `linklastfm`, `unlinkfm`, `fm`,
   `fmrecent`, `fmprofile`, `fmtopartists`, `fmtopalbums`, `fmtoptracks`.
   Covers 80% of what people actually use.
2. **Phase 2 — server features.** `fmwhoknows` (artist/album/track),
   `fmcrowns`, `fmleaderboard`, `fmtaste`, `fmcommon`. Turns it from a
   personal-stats tool into a server-wide game.
3. **Phase 3 — discovery + bridging into the player.** `fmrecommend`,
   `fmplay`, `fmplaytop`, `fmsimilar`. Best fit for our project because we
   *are* a music bot — `fmplay @friend` is a much better demo than any of
   Spotify's locked-down stats.
4. **Phase 4 — image charts.** `fmchart` collage generator. Needs `sharp` or
   `canvas` and a bit of layout work but huge wow factor.
5. **Phase 5 — writes.** Only if you're willing to host the OAuth callback.
   `fmlove`, `fmunlove`, `fmautoscrobble`.

---

## A note on rate limits

Last.fm's documented limit is 5 requests/second per API key, which is plenty
for our scale, but `fmwhoknows` in a 100-member server would fire ~100 calls
back-to-back. We'd need to throttle (`p-limit` or a tiny home-rolled queue)
and cache aggressively (per-artist+username for ~1h). Both are easy.

---

That's the menu. Tell me which ones you want and I'll write the proper spec
for those in `soul/chronicles/last-fm.md` and start implementing.
