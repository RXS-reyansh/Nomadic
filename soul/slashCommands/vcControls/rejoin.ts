// soul/slashCommands/vcControls/rejoin.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('rejoin')
  .setDescription('Make the bot leave and rejoin its current voice channel.');
