// soul/slashCommands/music/servervolume.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('servervolume')
  .setDescription('Set or reset the persistent server-wide playback volume.')
  .addStringOption(o => o.setName('value').setDescription('A number from 0-200, or "reset".').setRequired(true));
