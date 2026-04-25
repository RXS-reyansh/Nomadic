// soul/console/color-config.ts

// ─────────────────────────────────────────────────────────────────────────────
// ASCII boot art gradient palette
// ─────────────────────────────────────────────────────────────────────────────
// The boot ASCII art (rendered by `soul/console/asciiArt.ts`) is colored as a
// top-to-bottom gradient over these four colour stops. Tweak the four hexes
// below to recolour the boot ASCII without touching any other file.
export const asciiPalette: [string, string, string, string] = [
  '#FAF7F3', // top-most line
  '#F0E4D3',
  '#DCC5B2',
  '#D9A299', // bottom-most line
];

// ─────────────────────────────────────────────────────────────────────────────
// Per-tag colour map used by `logger.ts`. All colours used in the boot block
// MUST be defined here — never hardcode an ANSI escape elsewhere.
// ─────────────────────────────────────────────────────────────────────────────
export const colorConfig: Record<string, string> = {
  // ── Cluster / shard / client identification ──
  CLUSTER: '#d2eaf1',
  CLIENT: '#d2eaf1',
  SHARD: '#ff69b4',

  // ── Hosting / network info ──
  HOST: '#7ecfff',

  // ── Database (init + load-data) ──
  DATABASE: '#cb674c',
  'DATABASE - LOADING DATA': '#cb674c',

  // ── 24/7 auto-reconnect block ──
  'LOADING DATA - 24/7': '#cfffe2',
  '24/7': '#cfffe2',

  // ── Module loaders ──
  'EVENT LOADER': '#249bf0',
  'HELPERS LOADER': '#249bf0',
  'COMMANDS LOADER': '#249bf0',
  'SLASH LOADER': '#249bf0',
  HANDLERS: '#00ff00',

  // ── Developer / bot info / server list ──
  DEVELOPER: '#ff008c',
  'DEVELOPER-LOG': '#ff008c',
  BOT: '#ff0000',
  OWNER: '#ff0000',
  'SERVER LIST': '#ff7b00',

  // ── Slash commands (registration + executable loading) ──
  SLASH: '#ff7b00',

  // ── Lavalink / Node ──
  LAVALINK: '#4b2bcc',
  NODE: '#4b2bcc',

  // ── Status / presence ──
  STATUS: '#249bf0',

  // ── Music subsystems (not part of the boot block, but used at runtime) ──
  MUSIC: '#1e90ff',
  PLAYER: '#00bfff',
  QUEUE: '#9370db',

  // ── Ready / success / fallback ──
  'YAY!': '#249bf0',
  SUCCESS: '#00ff00',

  // ── Misc ──
  WARN: '#ffff00',
  ERROR: '#c147a1',
  LYRICS: '#f03671',
  WEBHOOK: '#7ecfff',
  GUILD: '#ff7b00',
  BOOTSTRAP: '#c147a1',

  // ── Legacy tags kept for runtime safety (may still be emitted by older code paths) ──
  'LOADING DATA': '#cfffe2',
  LOADER: '#249bf0',

  // ── Default fallback ──
  DEFAULT: '#ffffff',
};

export default colorConfig;
