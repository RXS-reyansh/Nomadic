// aether/utils/formatting.ts

/**
 * Format milliseconds to a human-readable duration string.
 * Supports hours, minutes, seconds, and optionally days.
 * @param ms - Duration in milliseconds
 * @param showDays - If true, includes days in the output (e.g., "2d 3h 45m")
 * @returns Formatted string (e.g., "03:45", "1:23:45", "LIVE", or "2d 3h")
 */
export function formatDuration(ms: number, showDays = false): string {
  if (!ms || ms <= 0 || !isFinite(ms)) return 'LIVE';

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  if (showDays && days > 0) {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Parse a duration string (e.g., "1:23", "3:45:21", "1h30m") into milliseconds.
 * @param str - Duration string
 * @returns Milliseconds, or null if invalid
 */
export function parseDuration(str: string): number | null {
  if (!str || typeof str !== 'string') return null;

  // Handle "hh:mm:ss" or "mm:ss"
  const colonMatch = str.match(/^(?:(\d+):)?(\d+):(\d+)$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1] || '0', 10);
    const minutes = parseInt(colonMatch[2], 10);
    const seconds = parseInt(colonMatch[3], 10);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  // Handle "1h 30m 45s" format
  let ms = 0;
  const hourMatch = str.match(/(\d+)\s*h/);
  if (hourMatch) ms += parseInt(hourMatch[1], 10) * 3600000;
  const minuteMatch = str.match(/(\d+)\s*m/);
  if (minuteMatch) ms += parseInt(minuteMatch[1], 10) * 60000;
  const secondMatch = str.match(/(\d+)\s*s/);
  if (secondMatch) ms += parseInt(secondMatch[1], 10) * 1000;
  if (ms > 0) return ms;

  return null;
}

/**
 * Extract a clean duration string from a track object.
 * @param track - Kazagumo track object
 * @returns Formatted duration, "LIVE", or "N/A"
 */
export function getTrackDuration(track: any): string {
  if (!track) return 'N/A';
  const info = track.info || track;
  if (info.isStream || info.isLive) return 'LIVE';
  const length = info.length;
  if (!length || length <= 0) return 'N/A';
  return formatDuration(length);
}

/**
 * Extract the best available thumbnail URL from track info.
 * Checks multiple common properties and nested objects.
 * @param trackInfo - Track info object (or track itself)
 * @returns URL string or null
 */
export function extractThumbnail(trackInfo: any): string | null {
  if (!trackInfo) return null;

  const info = trackInfo.info || trackInfo;

  // Direct properties (case-insensitive)
  const props = [
    'thumbnail',
    'artworkUrl',
    'artwork',
    'cover',
    'image',
    'picture',
    'thumbnailUrl',
    'thumbnail_url',
  ];
  for (const prop of props) {
    const val = info[prop];
    if (!val) continue;
    if (typeof val === 'string' && val.startsWith('http')) return val;
    if (typeof val === 'object' && val?.url?.startsWith('http')) return val.url;
    // Handle artwork array (Spotify)
    if (prop === 'artwork' && Array.isArray(val)) {
      const img = val.find((a: any) => a?.url?.startsWith('http'));
      if (img) return img.url;
    }
  }

  // Album images
  const album = info.album;
  if (album) {
    if (Array.isArray(album.images) && album.images.length) {
      const img = album.images[0];
      if (img?.url?.startsWith('http')) return img.url;
    }
    if (typeof album.image === 'string' && album.image.startsWith('http'))
      return album.image;
  }

  // YouTube-specific: construct from identifier
  const identifier = info.identifier;
  if (identifier && /^[A-Za-z0-9_-]{11}$/.test(identifier)) {
    return `https://img.youtube.com/vi/${identifier}/hqdefault.jpg`;
  }

  return null;
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 * @param str - Input string
 * @param maxLen - Maximum length (default 100)
 * @returns Truncated string
 */
export function truncate(str: string, maxLen = 100): string {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Clean a track title by removing common suffixes (e.g., "Official Video", "(Lyrics)").
 * @param title - Raw title
 * @returns Cleaned title
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[\(\[]\s*(official\s*)?(music|audio|video|lyrics?|visualizer|mv)\s*[\)\]]\s*/gi, '')
    .replace(/\s*-\s*.*$/, '') // Remove after dash
    .trim();
}

/**
 * Format a number with commas (e.g., 1000 → "1,000").
 * @param num - Number to format
 * @returns Formatted string
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Convert bytes to a human-readable size (e.g., "1.5 MB").
 * @param bytes - Number of bytes
 * @param decimals - Decimal places (default 2)
 * @returns Formatted string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format a Date object or timestamp into a short date string (e.g., "Apr 15, 2026").
 */
export function formatDate(date: Date | number | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format a Date into a relative time string (e.g., "2 hours ago").
 * Requires a small library like `dayjs` or manual calculation.
 */
export function formatRelativeTime(date: Date | number | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a number as a percentage (e.g., 0.7532 → "75.3%").
 */
export function formatPercent(value: number, decimals = 1): string {
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Escape Discord markdown formatting characters so text renders as plain text
 * inside a TextDisplay component. Escapes: \ * _ ~ ` | > # -
 * Use this for any server-generated or user-supplied text (e.g., guild names)
 * that gets placed directly into message content.
 * @param text - Raw text to escape
 * @returns Text with markdown special characters escaped
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\*_~`|>#\-]/g, '\\$&');
}

/**
 * Format a full uptime duration (seconds) into a compact string.
 * e.g. 90061 → "1d 1h 1m 1s"
 */
export function formatUptime(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0 || s > 0) parts.push(`${s}s`);
  return parts.join(' ');
}

/**
 * Format a year into a shortened two-digit form with a leading apostrophe.
 * e.g. 2026 → "'26", 2009 → "'09"
 */
export function formatShortYear(year: number): string {
  return `'${String(year).slice(-2).padStart(2, '0')}`;
}

/**
 * Format a Date into the debug "Created at" display format.
 * e.g. Fri, 02:30:15 PM, 15 April, '26
 */
export function formatCreatedAt(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const day = days[date.getUTCDay()];
  const dateNum = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = formatShortYear(date.getUTCFullYear());

  let hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const time = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

  return `${day}, ${time}, ${dateNum} ${month}, ${year}`;
}

/**
 * Format a queue position with ordinal suffix (1st, 2nd, 3rd, 4th).
 */
export function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Convert a Lavalink track object into a consistent display object.
 */
export function normalizeTrackInfo(track: any) {
  const info = track.info || track;
  return {
    title: cleanTitle(info.title || 'Unknown'),
    author: info.author || 'Unknown',
    duration: getTrackDuration(track),
    uri: info.uri || '',
    thumbnail: extractThumbnail(info),
    isStream: info.isStream || info.isLive || false,
  };
}
