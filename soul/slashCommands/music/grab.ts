// soul/slashCommands/music/grab.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('grab')
  .setDescription('DM yourself the details of the currently playing track.');
