// soul/commands/developer/note.ts
//
// Dev-only note command. Posts a formatted note to the configured notes
// channel, then sends a plain divider message after it.
//
// Subcommands set the keyword shown in the heading:
//   add / change / fix / remove → "To <KEYWORD>:"
//   other                       → "Stupid note:"
//
// Image support: attach an image to the command message OR put a single
// `https://…` URL as the very last token of the body. Same UX as `afk`.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess, sendNote } from '../../components/statusMessages.js';
import { resolveEmoji } from '../../helpers/emojiResolver.js';
import { parseSayText } from '../../helpers/emojiParser.js';
import { config } from '../../config.js';

export const options = {
  name: 'note',
  aliases: [] as string[],
  description: 'Post a developer note to the notes channel.',
  usage: `note add <text> [image URL or attachment]
  note change <text>
  note fix <text>
  note remove <text>
  note other <text>`,
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 0,
};

const SUBS = new Set(['add', 'change', 'fix', 'remove', 'other']);
const MAX_BODY = 3500;

function stripLeadingToken(raw: string): string {
  const s = raw.replace(/^\s+/, '');
  const m = s.match(/^\S+\s*/);
  return m ? s.slice(m[0].length) : '';
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };

  if (args.length === 0) {
    return sendError(ctx, `No subcommand provided. Usage:\n\`\`\`\n${options.usage}\n\`\`\``);
  }

  const sub = args[0].toLowerCase();
  if (!SUBS.has(sub)) {
    return sendError(ctx, `Unknown subcommand \`${args[0]}\`. Valid: \`add\`, \`change\`, \`fix\`, \`remove\`, \`other\`.`);
  }

  // Use the raw command args so Shift+Enter newlines are preserved verbatim.
  const fullRaw: string =
    typeof message.commandRawArgs === 'string' ? message.commandRawArgs : args.join(' ');
  let rawBody = stripLeadingToken(fullRaw).trim();

  // Image: prefer an attachment; otherwise accept a trailing URL.
  let imageUrl: string | null =
    message.attachments?.first?.()?.url ?? null;

  if (!imageUrl && rawBody) {
    const lastNL = rawBody.lastIndexOf('\n');
    const lastSeg = (lastNL >= 0 ? rawBody.slice(lastNL + 1) : rawBody).trim();
    const parts = lastSeg.split(/\s+/);
    const lastTok = parts[parts.length - 1] ?? '';
    if (/^https?:\/\/\S+$/i.test(lastTok)) {
      imageUrl = lastTok;
      // Trim that token off the body.
      const cut = rawBody.lastIndexOf(lastTok);
      rawBody = rawBody.slice(0, cut).trim();
    }
  }

  if (!rawBody && !imageUrl) return sendError(ctx, 'Provide note text (or an image).');
  if (rawBody.length > MAX_BODY) return sendError(ctx, 'Too much.');

  // Mirror say.ts text processing.
  const withNewlines = rawBody
    .replace(/\\\\n/g, '\u0000')
    .replace(/\\n/g, '\n')
    .replace(/\u0000/g, '\\n');

  const { text: body, invalid } = await parseSayText(withNewlines, (id) =>
    resolveEmoji(client, id, message.guild),
  );

  if (invalid.length) {
    return sendError(
      ctx,
      `Invalid emoji identifiers:\n${invalid.map((id) => `• \`${id}\``).join('\n')}`,
    );
  }

  const channelId = config.notesChannelId?.trim();
  if (!channelId) return sendError(ctx, 'Notes channel is not configured (`config.notesChannelId`).');

  const channel: any = client.channels.cache.get(channelId)
    ?? await client.channels.fetch(channelId).catch((): null => null);
  if (!channel || typeof channel.send !== 'function') {
    return sendError(ctx, 'Notes channel could not be resolved.');
  }

  const noteMsg = await sendNote(channel, sub, body, imageUrl).catch((): null => null);
  if (!noteMsg) return sendError(ctx, 'Failed to post note.');

  await channel.send({ content: config.noteDivider, allowedMentions: { parse: [] } }).catch((): null => null);

  await sendSuccess(ctx, 'Note posted.');
}
