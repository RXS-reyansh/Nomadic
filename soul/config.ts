// aether/config.ts
import "dotenv/config";

export interface Config {
  botName: string;
  botToken: string;
  clientId: string;
  prefix: string;
  language: string;
  developers: [string, string][];
  embedColor: string;
  fakeLowerCpuUsage: number;
  fakeUpperCpuUsage: number;
  minTotalRamMB: number;
  /**
   * If non-empty, this string is used as the hosting service display name
   * everywhere (debug menu "Powered by", etc.), and the hostingServices.ts
   * IP-matching config is ignored entirely.
   * Leave as empty string ("") to use automatic IP-based detection instead.
   */
  hardcodeHostingService: string;
  /**
   * The name of the database provider shown in the debug menu
   * (e.g. "MongoDB Atlas", "MongoDB Local", etc.).
   */
  databaseProvider: string;
  /**
   * Channel ID where the dev-only `note` command posts notes.
   */
  notesChannelId: string;
  /**
   * Plain-text divider message sent after every `note` post.
   */
  noteDivider: string;
  /**
   * Default search source prefix used when the user's query is plain text
   * (not a URL and not already prefixed with another source).
   * Supported by Lavalink + LavaSrc plugin:
   *   "ytsearch"   — YouTube
   *   "ytmsearch"  — YouTube Music
   *   "scsearch"   — SoundCloud
   *   "spsearch"   — Spotify (requires LavaSrc on the node)
   *   "dzsearch"   — Deezer  (requires LavaSrc on the node)
   *   "amsearch"   — Apple Music (requires LavaSrc on the node)
   *   "ymsearch"   — Yandex Music (requires LavaSrc on the node)
   */
  defaultSource: string;
  spotify: {
    clientId: string | undefined;
    clientSecret: string | undefined;
  };
  nodes: Array<{
    host: string;
    port: number;
    name: string;
    auth: string;
    secure: boolean;
  }>;
  supportServer: string;
  githubProfile: string;
  githubRepo: string;
  webhooks: {
    readyLog: string | undefined;
    shardLog: string | undefined;
    joinLeave: string | undefined;
    errorLog: string | undefined;
    commandLog: string | undefined;
    trackLog: string | undefined;
    nodeLog: string | undefined;
  };
  botInstances: Record<
    string,
    {
      clientId: string;
      displayServerCount?: number;
      buildName?: string;
      presence: {
        name: string;
        type: string;
        status: string;
      };
    }
  >;
  defaultPresence: {
    name: string;
    type: string;
    status: string;
  };
}

/** The display name of this bot — used everywhere instead of hardcoding. */
export const botName = "Nomadic";

export const config = {
  // Bot
  botName,
  botToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  prefix: "$$",
  language: "TypeScript",

  // Developers (name, id)
  developers: [
    ["Reyansh", "922491166149214218"],
    ["/reY", "1491240364382621696"],
  ],
  // The first developer is considered the "MAIN" developer and his/her name is used at wherever needed.

  // Default embed color (used for some godforsaken embeds if ever made)
  embedColor: "#b4f8c8",

  // Debug display fallbacks
  fakeLowerCpuUsage: 3.0,
  fakeUpperCpuUsage: 5.0,
  minTotalRamMB: 8092,

  // Hosting service override — leave as "" to use IP-based detection from soul/config/hostingServices.ts
  hardcodeHostingService: "Replit",

  // Database provider shown in the debug menu
  databaseProvider: "MongoDB Atlas",

  // Notes channel — dev-only `note` command posts here. Replace with a real channel ID.
  notesChannelId: "1496154115859021925",
  // Plain-text divider sent after every `note` post.
  noteDivider:
    "**. ݁₊ ⊹ . ݁ ⟡ ݁ . ⊹ ₊ ݁.. ݁₊ ⊹ . ݁ ⟡ ݁ . ⊹ ₊ ݁.. ݁₊ ⊹ . ݁ ⟡ ݁ . ⊹ ₊ ݁.**",

  // Default search source — used for plain-text queries (no URL, no prefix).
  // Common values: "ytsearch", "ytmsearch", "scsearch", "spsearch", "dzsearch", "amsearch", "ymsearch"
  // Anything other than YouTube/SoundCloud requires the LavaSrc plugin on the Lavalink node.
  defaultSource: "dzsearch",

  // Spotify
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  },

  // Lavalink nodes
  nodes: [
    {
      host: "lavalinkv4.serenetia.com",
      port: 80,
      name: "Serenetia",
      version: "v4",
      auth: "https://dsc.gg/ajidevserver",
      secure: false,
    },
  ],

  // Support & invite links
  supportServer: "https://discord.gg/YpCfcCTXdv",

  // Github links
  githubProfile: "https://github.com/RXS-reyansh",
  githubRepo: "https://github.com/RXS-reyansh/Hermaca-Music-Bot",

  // Webhooks (from .env)
  webhooks: {
    readyLog: process.env.READY_LOG_WEBHOOK_URL,
    shardLog: process.env.SHARD_LOG_WEBHOOK_URL,
    joinLeave: process.env.JOIN_LEAVE_WEBHOOK_URL,
    errorLog: process.env.ERROR_LOG_WEBHOOK_URL,
    commandLog: process.env.COMMAND_LOG_WEBHOOK_URL,
    trackLog: process.env.TRACK_LOG_WEBHOOK_URL,
    nodeLog: process.env.NODE_LOG_WEBHOOK_URL,
  },

  // Bot instances for multi-bot presence
  botInstances: {
    Main: {
      clientId: "923476129623453777",
      displayServerCount: 21,
      buildName: botName,
      presence: {
        name: "/help | 21 Guilds | {users} Users",
        type: "Listening",
        status: "idle",
      },
    },
    TheSecond: {
      clientId: "1471514482067902545",
      presence: {
        name: "$!help | {guilds} Servers",
        type: "Listening",
        status: "idle",
      },
    },
    TheThird: {
      clientId: "1457601829738250301",
      presence: {
        name: "music in 11 servers",
        type: "Streaming",
        status: "dnd",
      },
    },
    Beta: {
      clientId: "1442787596131373166",
      buildName: `BETA version of ${botName}`,
      presence: {
        name: `BETA Version of ${botName}`,
        type: "Playing",
        status: "dnd",
      },
    },
  },

  // Default presence
  defaultPresence: {
    name: "/help | {guilds} Guilds",
    type: "Listening",
    status: "idle",
  },
};

export default config;
