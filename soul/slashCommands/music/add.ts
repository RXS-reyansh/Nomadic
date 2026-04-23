// soul/slashCommands/music/add.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('add')
  .setDescription('Add a song or playlist at a specific queue position.')
  .addIntegerOption(o => o.setName('position').setDescription('Queue position (1 = next).').setRequired(true).setMinValue(1))
  .addStringOption(o => o.setName('song').setDescription('Song name or URL.').setRequired(true));
