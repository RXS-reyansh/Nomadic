// soul/slashCommands/music/skip.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current song and play the next one in the queue.');
