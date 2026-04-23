// soul/slashCommands/music/skipto.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('skipto')
  .setDescription('Skip to a specific track position in the queue.')
  .addIntegerOption(option =>
    option
      .setName('position')
      .setDescription('The queue position to skip to (starting from 1).')
      .setRequired(true)
      .setMinValue(1),
  );
