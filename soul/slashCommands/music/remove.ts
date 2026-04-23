// soul/slashCommands/music/remove.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a track at the given queue position.')
  .addIntegerOption(o => o.setName('position').setDescription('Queue position to remove.').setRequired(true).setMinValue(1));
