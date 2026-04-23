// soul/slashCommands/music/pause.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause the currently playing track.');
