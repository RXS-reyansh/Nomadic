// soul/slashCommands/music/resume.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Resume the currently paused track.');
