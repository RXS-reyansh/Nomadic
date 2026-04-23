// soul/slashCommands/music/move.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('move')
  .setDescription('Move a queued track to a new position.')
  .addIntegerOption(o => o.setName('from').setDescription('Current position.').setRequired(true).setMinValue(1))
  .addIntegerOption(o => o.setName('to').setDescription('Target position.').setRequired(true).setMinValue(1));
