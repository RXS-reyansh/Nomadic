// soul/slashCommands/music/clear.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear all upcoming tracks from the queue.');
