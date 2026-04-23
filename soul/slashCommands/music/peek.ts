// soul/slashCommands/music/peek.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('peek')
  .setDescription('Preview a track in the queue without playing it.')
  .addIntegerOption(option =>
    option
      .setName('position')
      .setDescription('The queue position to preview (starting from 1).')
      .setRequired(true)
      .setMinValue(1),
  );
