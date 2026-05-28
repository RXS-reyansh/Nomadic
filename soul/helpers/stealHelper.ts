// soul/helpers/stealHelper.ts
//
// Helpers for the steal command: custom emoji / sticker parsing and guild creation.
// Covers ALL custom emoji formats (static, animated) and ALL stealable sticker
// formats (PNG, APNG, GIF). Lottie stickers are flagged separately because
// they use Discord's proprietary JSON animation format and cannot be recreated.
//
// Robustness notes:
//   • Discord's emoji CDN serves the same asset under multiple extensions
//     (.gif, .png, .webp). The regex flag `<a:...>` vs `<:...>` is only a
//     hint from the message author and does NOT always match the asset's
//     real format (an animated emoji typed as `<:name:id>` still exists as
//     a GIF on the CDN, and vice versa). We therefore download the asset
//     ourselves — trying GIF first, then PNG, then WEBP — and pass the
//     resulting buffer to the create call. This avoids the "Invalid Asset"
//     error Discord returns when the URL it tries to fetch 404s.

import { StickerFormatType, type Guild, type Sticker } from 'discord.js';

// ─────────────────────────── Shared types ────────────────────────────────────

export interface ParsedEmoji {
  id: string;
  name: string;
  animated: boolean;
}

export interface EmojiStealResult {
  parsed: ParsedEmoji;
  success: boolean;
  created?: any;
  error?: string;
}

export interface StickerStealResult {
  sticker: Sticker;
  success: boolean;
  created?: any;
  error?: string;
  /** True when the sticker is Lottie — no bot can steal these. */
  lottie?: boolean;
}

// ─────────────────────────── Emoji helpers ────────────────────────────────────

// Matches <:name:id> (static) and <a:name:id> (animated). Name: 2–32 word chars.
const CUSTOM_EMOJI_RE = /<(a?):(\w{2,32}):(\d{17,20})>/g;

/**
 * Extracts every unique custom emoji from one or more text strings.
 * Deduplication is by emoji ID — the same emoji appearing in multiple
 * messages / positions is only returned once.
 */
export function extractCustomEmojis(...texts: string[]): ParsedEmoji[] {
  const seen = new Set<string>();
  const results: ParsedEmoji[] = [];

  for (const text of texts) {
    CUSTOM_EMOJI_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CUSTOM_EMOJI_RE.exec(text)) !== null) {
      const [, a, name, id] = m;
      if (!seen.has(id)) {
        seen.add(id);
        results.push({ id, name, animated: a === 'a' });
      }
    }
  }

  return results;
}

/**
 * Sanitizes a string for use as a Discord emoji / sticker name.
 * Rules: 2–32 characters, alphanumeric + underscores only.
 */
export function sanitizeName(raw: string): string {
  let name = raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/__+/g, '_').replace(/^_+|_+$/g, '');
  if (name.length < 2) name = name.padEnd(2, '_');
  if (name.length > 32) name = name.slice(0, 32);
  return name || '__';
}

/**
 * Downloads the first URL that returns a 200 OK with a non-empty body.
 * Returns the buffer + the URL that succeeded (so the caller can reason
 * about which extension actually exists on the CDN).
 */
async function downloadFirstAvailable(urls: string[]): Promise<{ buf: Buffer; url: string } | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const ab = await res.arrayBuffer();
      if (!ab.byteLength) continue;
      return { buf: Buffer.from(ab), url };
    } catch {
      // Try next URL
    }
  }
  return null;
}

/**
 * Attempts to add a custom emoji to a guild.
 *
 * The asset bytes are downloaded ourselves so that an animated-but-flagged-as-static
 * emoji (or any other CDN/extension mismatch) doesn't cause Discord's emoji
 * upload endpoint to reject the request with "Invalid Asset".
 */
export async function stealEmoji(guild: Guild, parsed: ParsedEmoji): Promise<EmojiStealResult> {
  // Try in this order so animated frames are preserved when present:
  //   1. .gif  (animated; works for animated emojis)
  //   2. .png  (static; works for static emojis)
  //   3. .webp (Discord also serves a webp for both — last-resort fallback)
  const base = `https://cdn.discordapp.com/emojis/${parsed.id}`;
  const urls = parsed.animated
    ? [`${base}.gif`, `${base}.png`, `${base}.webp`]
    : [`${base}.png`, `${base}.gif`, `${base}.webp`];

  const downloaded = await downloadFirstAvailable(urls);
  if (!downloaded) {
    return {
      parsed,
      success: false,
      error: 'Could not download the emoji asset from Discord\'s CDN.',
    };
  }

  try {
    const name = sanitizeName(parsed.name);
    const created = await (guild.emojis as any).create({
      attachment: downloaded.buf,
      name,
    });
    return { parsed, success: true, created };
  } catch (err: any) {
    return { parsed, success: false, error: err?.message ?? String(err) };
  }
}

// ─────────────────────────── Sticker helpers ─────────────────────────────────

/**
 * Returns the candidate downloadable CDN URLs for a sticker, or null for
 * Lottie stickers (format 3 — proprietary JSON animation that cannot be
 * re-uploaded as a static image).
 *
 * Confirmed extension map (discord.js StickerFormatExtensionMap):
 *   PNG  (1) → .png
 *   APNG (2) → .png  (CDN delivers the full animated APNG bytes at this URL)
 *   Lottie (3) → .json (not a valid image — cannot steal)
 *   GIF  (4) → .gif
 */
function stickerUrls(sticker: Sticker): string[] | null {
  switch (sticker.format) {
    case StickerFormatType.PNG:
    case StickerFormatType.APNG:
      return [
        `https://cdn.discordapp.com/stickers/${sticker.id}.png`,
        `https://media.discordapp.net/stickers/${sticker.id}.png`,
      ];
    case StickerFormatType.GIF:
      return [
        `https://media.discordapp.net/stickers/${sticker.id}.gif`,
        `https://cdn.discordapp.com/stickers/${sticker.id}.gif`,
      ];
    case StickerFormatType.Lottie:
    default:
      return null;
  }
}

/**
 * Attempts to add a sticker to a guild.
 * Lottie stickers are returned with `lottie: true` so the caller can give a
 * specific explanation rather than a generic error.
 */
export async function stealSticker(guild: Guild, sticker: Sticker): Promise<StickerStealResult> {
  if (sticker.format === StickerFormatType.Lottie) {
    return {
      sticker,
      success: false,
      lottie: true,
      error: 'Lottie stickers use Discord\'s proprietary animation format and cannot be stolen by any bot.',
    };
  }

  const urls = stickerUrls(sticker);
  if (!urls) {
    return { sticker, success: false, error: 'Could not resolve sticker URL.' };
  }

  const downloaded = await downloadFirstAvailable(urls);
  if (!downloaded) {
    return {
      sticker,
      success: false,
      error: 'Could not download the sticker asset from Discord\'s CDN.',
    };
  }

  try {
    const name = sanitizeName(sticker.name);
    // `tags` must be a single Unicode emoji string (Discord API requirement).
    // Use the sticker's original tags if present, otherwise a neutral default.
    const tags: string = (sticker as any).tags || '⭐';

    const created = await (guild.stickers as any).create({
      file: downloaded.buf,
      name,
      description: (sticker as any).description ?? '',
      tags,
    });
    return { sticker, success: true, created };
  } catch (err: any) {
    return { sticker, success: false, error: err?.message ?? String(err) };
  }
}
