// soul/commands/utility/sticky.ts
//
// Manage sticky messages — only one per channel, only Administrators may set,
// enable, disable, or view. Subcommands:
//
//   sticky set [text|cv2|component|embed] <body>
//   sticky enable                             (re-enables a paused sticky)
//   sticky disable                            (pauses without deleting config)
//   sticky view                               (shows the stored payload)
//
// `set` always enables the sticky. If the second positional arg is one of
// the type keywords it switches modes; otherwise the mode defaults to text
// and the entire remainder is treated as the body. Text bodies support \n
// escapes and `$emoji<name_or_id>` placeholders (same pipeline as `say`).

import { codeBlock, PermissionFlagsBits } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { resolveEmoji } from '../../helpers/emojiResolver.js';
import { parseSayText } from '../../helpers/emojiParser.js';
import {
  setStickyAndPost,
  postStickyToChannel,
  type StickyType,
} from '../../helpers/stickyHelper.js';

export const options = {
  name: 'sticky',
  aliases: [] as string[],
  description: 'Manage sticky messages that stay at the bottom of the channel.',
  usage: `sticky set <text>
  sticky set text <text>
  sticky set cv2 <json>
  sticky set component <json>
  sticky set embed <json>
  sticky enable
  sticky disable
  sticky view`,
  category: 'utility',
  isDeveloper: false,
  userPerms: ['Administrator'] as string[],
  botPerms: ['SendMessages', 'ManageMessages'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

const TYPE_KEYWORDS: Record<string, StickyType> = {
  text: 'text',
  cv2: 'cv2',
  component: 'cv2',
  components: 'cv2',
  embed: 'embed',
  embeds: 'embed',
};

function describeType(t: StickyType): string {
  return t === 'cv2' ? 'Components V2' : t === 'embed' ? 'Embed' : 'Text';
}

/**
 * Drop the first `count` whitespace-separated tokens from `raw` while keeping
 * the remainder of the string byte-for-byte (newlines and inner spacing
 * preserved). Used to skip the subcommand (and optional type keyword) from
 * the raw user input.
 */
function stripLeadingTokens(raw: string, count: number): string {
  let s = raw.replace(/^\s+/, '');
  for (let i = 0; i < count; i++) {
    const m = s.match(/^\S+\s*/);
    if (!m) return '';
    s = s.slice(m[0].length);
  }
  return s;
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };

  if (!message.guild) return sendError(ctx, 'This command can only be used in a server.');

  // Belt-and-braces admin check (validate() already runs Administrator perm,
  // but make it explicit — devs are not auto-bypassed for sticky).
  const perms = message.member?.permissions;
  if (!perms?.has?.(PermissionFlagsBits.Administrator)) {
    return sendError(ctx, 'You need the **Administrator** permission to manage sticky messages.');
  }

  const sub = args[0]?.toLowerCase();
  if (!sub || !['set', 'enable', 'disable', 'view'].includes(sub)) {
    return sendError(ctx, `Usage:\n\`\`\`\n${options.usage}\n\`\`\``);
  }

  const guildId: string = message.guild.id;
  const channelId: string = message.channel.id;

  // ── view ──────────────────────────────────────────────────────────────────
  if (sub === 'view') {
    const data = await client.db.getSticky(guildId, channelId);
    if (!data) return sendInfo(ctx, 'No sticky message is set in this channel.');
    const status = data.enabled ? 'enabled' : 'disabled';

    // For cv2 / embed, the stored payload is raw JSON which is noisy and
    // useless to show in chat. Just summarise it.
    if (data.type !== 'text') {
      return sendInfo(
        ctx,
        `Sticky in <#${channelId}> — type: **${describeType(data.type)}**, status: **${status}**\n` +
          `*${describeType(data.type)} payload set (${data.payload.length.toLocaleString()} chars).*`,
      );
    }

    const body = data.payload.length > 1800 ? data.payload.slice(0, 1800) + '…' : data.payload;
    return sendInfo(
      ctx,
      `Sticky in <#${channelId}> — type: **Text**, status: **${status}**\n${codeBlock('', body)}`,
    );
  }

  // ── enable ────────────────────────────────────────────────────────────────
  if (sub === 'enable') {
    const data = await client.db.getSticky(guildId, channelId);
    if (!data) return sendError(ctx, 'No sticky message is configured for this channel. Use `sticky set <text>` first.');
    if (data.enabled) return sendInfo(ctx, 'The sticky in this channel is **already enabled**.');
    await client.db.setStickyEnabled(guildId, channelId, true);
    await sendSuccess(ctx, 'Sticky message **enabled** for this channel.');
    // Re-post immediately at the bottom.
    await postStickyToChannel(client, message.channel, guildId, channelId, data.type, data.payload);
    return;
  }

  // ── disable ───────────────────────────────────────────────────────────────
  if (sub === 'disable') {
    const data = await client.db.getSticky(guildId, channelId);
    if (!data) return sendError(ctx, 'No sticky message is configured for this channel.');
    if (!data.enabled) return sendInfo(ctx, 'The sticky in this channel is **already disabled**.');
    await client.db.setStickyEnabled(guildId, channelId, false);
    // Remove the live sticky message if one is currently up.
    const key = `${guildId}-${channelId}`;
    const prevId = client.stickyMessages.get(key) ?? data.last_message_id;
    if (prevId) {
      const prev = await message.channel.messages.fetch(prevId).catch((): null => null);
      if (prev) await prev.delete().catch((): null => null);
      client.stickyMessages.delete(key);
    }
    return sendSuccess(ctx, 'Sticky message **disabled** for this channel.');
  }

  // ── set ───────────────────────────────────────────────────────────────────
  // sub === 'set' from here.

  // Resolve type (optional) — if args[1] is a keyword, treat it as the mode.
  let type: StickyType = 'text';
  let bodyStart = 1;
  if (args[1]) {
    const maybeType = args[1].toLowerCase();
    if (TYPE_KEYWORDS[maybeType]) {
      type = TYPE_KEYWORDS[maybeType];
      bodyStart = 2;
    }
  }

  // Pull the raw body. For text we want to preserve original spacing AND
  // real newlines (Shift+Enter), so prefer message.commandRawArgs (set by
  // messageCreate) and strip the leading subcommand + optional type keyword.
  const fullRaw: string =
    typeof message.commandRawArgs === 'string' ? message.commandRawArgs : args.slice(0).join(' ');
  let rawBody = stripLeadingTokens(fullRaw, bodyStart === 2 ? 2 : 1).trim();

  // Fallback: if no inline body was supplied, fetch the first attachment and
  // use its text contents. This is how users send long Components V2 / embed
  // JSON that exceeds Discord's 2000-char message limit (Discord auto-uploads
  // it as `message.txt`).
  if (!rawBody && message.attachments?.size) {
    const attachment = message.attachments.first();
    const MAX_ATTACHMENT_BYTES = 1_000_000; // 1 MB hard cap.
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      return sendError(ctx, `Attachment is too large (max ${MAX_ATTACHMENT_BYTES.toLocaleString()} bytes).`);
    }
    try {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rawBody = (await res.text()).trim();
    } catch (err: any) {
      return sendError(ctx, `Failed to read attachment: \`${err.message}\``);
    }
    if (!rawBody) return sendError(ctx, 'The attached file is empty.');
  }

  if (!rawBody) return sendError(ctx, 'Provide a sticky body after the subcommand (or attach a file).');

  let finalPayload = rawBody;

  if (type === 'text') {
    // \n → real newline (preserve literal backslash-n via placeholder).
    const withNewlines = rawBody
      .replace(/\\\\n/g, '\u0000')
      .replace(/\\n/g, '\n')
      .replace(/\u0000/g, '\\n');

    const { text, invalid } = await parseSayText(withNewlines, (id) =>
      resolveEmoji(client, id, message.guild),
    );
    if (invalid.length) {
      return sendError(
        ctx,
        `Invalid emoji identifiers:\n${invalid.map((id) => `• \`${id}\``).join('\n')}`,
      );
    }
    if (text.length > 2000) {
      return sendError(ctx, 'Sticky text is too long (max 2000 characters).');
    }
    finalPayload = text;
  } else {
    // cv2 / embed → user supplies JSON. Validate parseability up-front.
    try {
      JSON.parse(rawBody);
    } catch (err: any) {
      return sendError(ctx, `Invalid JSON for ${describeType(type)} sticky:\n\`${err.message}\``);
    }
  }

  // Try a dry-run send first by going through setStickyAndPost — it does the
  // post and returns null on failure. If it fails for cv2/embed (Discord
  // rejected the structure) we surface a useful error to the user.
  await sendSuccess(ctx, `Sticky message **set** for <#${channelId}> (type: **${describeType(type)}**).`);
  const sent = await setStickyAndPost(client, message.channel, guildId, channelId, type, finalPayload);
  if (!sent) {
    return sendError(ctx, 'Sticky was saved but the message could not be sent. Check your JSON or my permissions.');
  }
}
