// aether/console/color-config.ts
export const colorConfig: Record<string, string> = {
  // Core system tags
  CLUSTER: '#d2eaf1',        // Light blue
  CLIENT: '#d2eaf1',
  DATABASE: '#cb674c',       // Terracotta
  NODE: '#4b2bcc',           // Purple
  LAVALINK: '#4b2bcc',       // Same as NODE
  SHARD: '#ff69b4',          // Pink

  // Loading phases
  'LOADING DATA': '#cfffe2',
  '24/7': '#cfffe2',

  // Owner / Bot info
  OWNER: '#ff0000',
  BOT: '#ff0000',

  // Server list
  'SERVER LIST': '#ff7b00',

  // Slash commands
  SLASH: '#ff7b00',

  // Success / Ready
  'YAY!': '#249bf0',
  SUCCESS: '#00ff00',

  // Warnings
  WARN: '#ffff00',

  // Errors (base color, -ERROR suffix will use same color)
  ERROR: '#c147a1',

  // Specialized
  LYRICS: '#f03671',
  STATUS: '#249bf0',
  LOADER: '#249bf0',
  DEVELOPER: '#ff008c',
  'DEVELOPER-LOG': '#ff008c',

  // Music
  MUSIC: '#1e90ff',
  PLAYER: '#00bfff',
  QUEUE: '#9370db',

  // Hosting / network info
  HOST: '#7ecfff',

  // Default fallback
  DEFAULT: '#ffffff',
};

export default colorConfig;
