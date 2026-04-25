// soul/console/logger.ts
import colorConfig from './color-config.js';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SUCCESS';

// Convert hex to RGB for true color support
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Apply RGB color to text
function colorize(text: string, hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return text;
  return `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${text}\x1b[0m`;
}

// State
let botReady = false;
let logLevel: LogLevel = 'INFO';

export function setBotReady(value: boolean): void {
  botReady = value;
}

export function setLogLevel(level: LogLevel): void {
  logLevel = level;
}

// Tags allowed to keep emitting after the boot block has fully completed.
// Everything else falls silent (except errors) once `setBotReady(true)` is
// called at the end of bootstrap.
const allowedAfterReady = new Set<string>([
  'LYRICS',
  'DEVELOPER',
  'DEVELOPER-LOG',
  'ERROR',
  'GUILD',
  'NODE',
  'WEBHOOK',
  '24/7',
  'LOADING DATA - 24/7',
]);

// Core log function
export function log(tag: string, message: string, isError: boolean = false): void {
  const baseTag = tag.replace(/-ERROR$/, '');
  if (botReady && !isError && !allowedAfterReady.has(baseTag) && !allowedAfterReady.has(tag)) {
    return;
  }

  const finalTag = isError && !tag.endsWith('-ERROR') ? `${tag}-ERROR` : tag;
  const baseTagForColor = finalTag.replace(/-ERROR$/, '');
  const colorHex = colorConfig[baseTagForColor] || colorConfig.DEFAULT;
  const coloredTag = colorize(`[${finalTag}]`, colorHex);

  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`${timestamp} ${coloredTag} ${message}`);
}

// Convenience methods
export const logger = {
  info: (tag: string, message: string) => log(tag, message, false),
  warn: (tag: string, message: string) => log(tag, message, false),
  error: (tag: string, message: string) => log(tag, message, true),
  debug: (tag: string, message: string) => {
    if (logLevel === 'DEBUG') log(tag, message, false);
  },
  /**
   * Success uses the TAG's own colour from color-config (not a single global
   * SUCCESS green). This keeps the boot block colour-coherent — every line
   * sharing a tag also shares a colour.
   */
  success: (tag: string, message: string) => {
    if (botReady && !allowedAfterReady.has(tag)) return;
    const colorHex = colorConfig[tag] || colorConfig.SUCCESS;
    const coloredTag = colorize(`[${tag}]`, colorHex);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log(`${timestamp} ${coloredTag} ${message}`);
  },
  developerLog: (message: string) => log('DEVELOPER-LOG', message, false),
  /**
   * Section divider — printed between every boot block.
   */
  line: () => console.log('━─━────༺༻────━─━━─━────༺༻────━─━'),
};

export default logger;
