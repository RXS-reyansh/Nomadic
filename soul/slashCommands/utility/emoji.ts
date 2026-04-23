// soul/slashCommands/utility/emoji.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('emoji')
  .setDescription('Send one or more emojis as a message.')
  .addStringOption(o =>
    o.setName('emojis')
      .setDescription('Emoji name(s) or ID(s). Use |$| to join without space, spaces to separate.')
      .setRequired(true),
  );
