// soul/config.ts
//
// Central runtime configuration for the bot.
//
// File layout (top → bottom, in priority order):
//   1.  Bot identity            — name, token, clientId, prefix, language
//   2.  Developers              — owner / co-owner list
//   3.  Music defaults          — default search source
//   4.  Display labels          — strings shown in the debug menu
//   5.  Notes channel           — `note` dev command target + divider
//   6.  Embed color             — fallback embed accent color
//   7.  External services       — Spotify, Last.fm, etc. (env-driven)
//   8.  Lavalink nodes          — node connection list
//   9.  Links                   — public links (support server, etc.)
//   10. Webhooks                — log-channel webhook URLs (env-driven)
//   11. Default presence        — fallback presence used only when no
//                                 entry in `soul/config/botInstances.ts`
//                                 matches the running clientId.
//
// Per-bot status / presence config lives in `soul/config/botInstances.ts`.
// Hosting IP → display-name map lives in `soul/config/hostingServices.ts`.
// Debug-command tunables live in `soul/config/debug-config.ts`.

import "dotenv/config";

// ─────────────────────────────────────────────────────────────────────────────
// Type
// ─────────────────────────────────────────────────────────────────────────────

export interface Config {
  // 1. Bot identity
  /** Display name of this bot — used everywhere instead of hardcoding. */
  botName: string;
  /** Discord bot token (from env). */
  botToken: string | undefined;
  /** Discord application / client ID (from env). */
  clientId: string | undefined;
  /** Default text-command prefix. */
  prefix: string;
  /** Programming language label (shown in the debug menu). */
  language: string;

  // 2. Developers
  /** `[name, id][]` — first entry is treated as the MAIN developer. */
  developers: [string, string][];

  // 3. Music defaults
  /**
   * Default Lavalink search prefix used when the user's query is plain text
   * (not a URL and not already prefixed).
   *   "ytsearch"  — YouTube
   *   "ytmsearch" — YouTube Music
   *   "scsearch"  — SoundCloud
   *   "spsearch"  — Spotify     (requires LavaSrc on the node)
   *   "dzsearch"  — Deezer      (requires LavaSrc on the node)
   *   "amsearch"  — Apple Music (requires LavaSrc on the node)
   *   "ymsearch"  — Yandex      (requires LavaSrc on the node)
   */
  defaultSource: string;

  // 4. Display labels
  /**
   * Hosting service display override. When a non-empty string, this exact
   * value is shown as the hosting provider everywhere (debug menu, ready
   * webhook, etc.) and the IP-matching table in
   * `soul/config/hostingServices.ts` is bypassed entirely.
   * Set to "" to use automatic IP-based detection.
   */
  hardcodeHostingService: string;
  /** Database provider label shown in the debug menu. */
  databaseProvider: string;

  // 5. Notes channel
  /** Channel ID where the dev-only `note` command posts notes. */
  notesChannelId: string;
  /** Plain-text divider message sent after every `note` post. */
  noteDivider: string;

  // 6. Embed color
  /** Default embed accent color (hex). */
  embedColor: string;

  // 7. External services
  spotify: {
    clientId: string | undefined;
    clientSecret: string | undefined;
  };
  lastfm: {
    apiKey: string | undefined;
  };

  // 9. Lavalink nodes
  nodes: Array<{
    host: string;
    port: number;
    name: string;
    auth: string;
    secure: boolean;
  }>;

  // 10. Links
  /** Public support server invite URL. */
  supportServer: string;

  // 11. Webhooks (env-driven; any may be undefined)
  webhooks: {
    readyLog: string | undefined;
    shardLog: string | undefined;
    joinLeave: string | undefined;
    errorLog: string | undefined;
    commandLog: string | undefined;
    trackLog: string | undefined;
    nodeLog: string | undefined;
  };

  // 12. Default presence
  /**
   * Fallback presence — applied by `hermaca.ts` only when no entry in
   * `soul/config/botInstances.ts` matches the running clientId.
   */
  defaultPresence: {
    name: string;
    type: string;
    status: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot name (named export — imported directly by many modules)
// ─────────────────────────────────────────────────────────────────────────────

/** Display name of this bot — used everywhere instead of hardcoding. */
export const botName = "Nomadic";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export const config: Config = {
  // ── 1. Bot identity ────────────────────────────────────────────────────────
  botName,
  botToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  prefix:   "$$",
  language: "TypeScript",

  // ── 2. Developers ──────────────────────────────────────────────────────────
  // The first developer is treated as the MAIN developer wherever needed.
  developers: [
    ["Reyansh", "922491166149214218"],
    ["/reY",    "1491240364382621696"],
  ],

  // ── 3. Music defaults ──────────────────────────────────────────────────────
  defaultSource: "dzsearch",

  // ── 4. Display labels ──────────────────────────────────────────────────────
  // Leave hardcodeHostingService as "" to use IP-based detection from
  // soul/config/hostingServices.ts.
  hardcodeHostingService: "Replit",
  databaseProvider:       "MongoDB Atlas",

  // ── 5. Notes channel ───────────────────────────────────────────────────────
  notesChannelId: "1496154115859021925",
  noteDivider:
    "**. ݁₊ ⊹ . ݁ ⟡ ݁ . ⊹ ₊ ݁.. ݁₊ ⊹ . ݁ ⟡ ݁ . ⊹ ₊ ݁.. ݁₊ ⊹ . ݁ ⟡ ݁ . ⊹ ₊ ݁.**",

  // ── 6. Embed color ─────────────────────────────────────────────────────────
  embedColor: "#b4f8c8",

  // ── 7. External services ───────────────────────────────────────────────────
  spotify: {
    clientId:     process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  },
  lastfm: {
    apiKey: process.env.LASTFM_API_KEY,
  },

  // ── 8. Lavalink nodes ──────────────────────────────────────────────────────
  // Nodes are tried in order — the first one to connect wins the boot slot.
  // All nodes stay connected; Shoukaku routes new players to whichever has
  // the least load (automatically skipping unreachable nodes). When a node
  // drops mid-session, players migrate to the next available node
  // (moveOnDisconnect: true in HermacaClient.initKazagumo).
  nodes: [
    {
      host:   "lavalinkv4.serenetia.com",
      port:   443,
      name:   "Serenetia",
      auth:   "https://seretia.link/discord",
      secure: true,
    },
    {
      host: "lavalink.jirayu.net",
      port: 13592,
      name: "Jirayu",
      auth: "youshallnotpass",
      secure: false
    },
    {
      host:   "89.106.84.59",
      port:   4000,
      name:   "HeavenCloud",
      auth:   "heavencloud.in",
      secure: false,
    },
  ],

  // ── 9. Links ───────────────────────────────────────────────────────────────
  supportServer: "https://discord.gg/YpCfcCTXdv",

  // ── 10. Webhooks (from .env) ───────────────────────────────────────────────
  webhooks: {
    readyLog:   process.env.READY_LOG_WEBHOOK_URL,
    shardLog:   process.env.SHARD_LOG_WEBHOOK_URL,
    joinLeave:  process.env.JOIN_LEAVE_WEBHOOK_URL,
    errorLog:   process.env.ERROR_LOG_WEBHOOK_URL,
    commandLog: process.env.COMMAND_LOG_WEBHOOK_URL,
    trackLog:   process.env.TRACK_LOG_WEBHOOK_URL,
    nodeLog:    process.env.NODE_LOG_WEBHOOK_URL,
  },

  // ── 11. Default presence ───────────────────────────────────────────────────
  // Fallback only — used when no botInstances.ts entry matches the running
  // clientId. Per-bot presences are defined in soul/config/botInstances.ts.
  defaultPresence: {
    name:   "/help | {guilds} Guilds",
    type:   "Listening",
    status: "idle",
  },
};

export default config;
