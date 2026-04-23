// soul/commands/utility/emoji.ts
//
// Send one or more emojis as a message.
//
// Emoji identifiers are separated by |$| (no space between emojis)
// or by spaces (space between emojis).
//
// Examples:
//   $$emoji Black_Butterfly           → sends the emoji
//   $$emoji 1234567890                → emoji by ID
//   $$emoji hello|$|world             → helloworld (no space)
//   $$emoji hello world               → hello world (space)

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { resolveEmoji } from '../../helpers/emojiResolver.js';

export const options = {
  name: 'emoji',
  aliases: ['em'] as string[],
  description: 'Send one or more emojis as a message.',
  usage: `emoji <name or ID>
  emoji <name1>|$|<name2>
  emoji <name1> <name2>`,
  category: 'utility',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 2,
};

const NO_SPACE_SEP = '|$|';

/**
 * Parse a raw input string into groups of identifiers.
 * Each space-separated token is a group; within a group |$| separates identifiers.
 */
function parseInput(input: string): string[][] {
  return input.split(/\s+/).map((token) => token.split(NO_SPACE_SEP));
}

// ─── Prefix execute ──────────────────────────────────────────────────────────

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const input = args.join(' ').trim();
  if (!input) return sendError({ message }, 'Please provide emoji identifiers.');

  const groups = parseInput(input);
  const resolvedGroups: string[] = [];
  const invalid: string[] = [];

  for (const group of groups) {
    const resolvedParts: string[] = [];
    for (const ident of group) {
      if (!ident) continue;
      const emoji = await resolveEmoji(client, ident, message.guild);
      if (emoji) {
        resolvedParts.push(emoji.toString());
      } else {
        invalid.push(ident);
      }
    }
    if (resolvedParts.length) resolvedGroups.push(resolvedParts.join(''));
  }

  const finalString = resolvedGroups.join(' ').trim();

  if (!finalString && invalid.length) {
    return sendError({ message }, 'All provided emoji identifiers were invalid!');
  }

  await message.delete().catch(() => {});

  if (finalString) {
    if (message.reference?.messageId) {
      const replied = await message.channel.messages.fetch(message.reference.messageId).catch((): null => null);
      if (replied) {
        await replied.reply(finalString).catch(() => message.channel.send(finalString));
      } else {
        await message.channel.send(finalString);
      }
    } else {
      await message.channel.send(finalString);
    }
  }

  if (invalid.length) {
    const errMsg = await sendError(
      { channel: message.channel },
      `Some emoji identifiers were invalid:\n${invalid.map((id) => `• \`${id}\``).join('\n')}`,
    );
    if (errMsg) setTimeout(() => (errMsg as any).delete().catch(() => {}), 6000);
  }
}

// ─── Slash execute ───────────────────────────────────────────────────────────

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();

  const input: string = interaction.options.getString('emojis', true).trim();
  const groups = parseInput(input);
  const resolvedGroups: string[] = [];
  const invalid: string[] = [];

  for (const group of groups) {
    const resolvedParts: string[] = [];
    for (const ident of group) {
      if (!ident) continue;
      const emoji = await resolveEmoji(client, ident, interaction.guild);
      if (emoji) {
        resolvedParts.push(emoji.toString());
      } else {
        invalid.push(ident);
      }
    }
    if (resolvedParts.length) resolvedGroups.push(resolvedParts.join(''));
  }

  const finalString = resolvedGroups.join(' ').trim();

  if (!finalString && invalid.length) {
    return sendError({ interaction }, 'All provided emoji identifiers were invalid!');
  }

  if (finalString) {
    await interaction.channel.send(finalString);
  }

  if (invalid.length) {
    return sendError(
      { interaction },
      `Some emoji identifiers were invalid:\n${invalid.map((id) => `• \`${id}\``).join('\n')}`,
    );
  }

  return sendSuccess({ interaction }, 'Emoji message sent.');
}
