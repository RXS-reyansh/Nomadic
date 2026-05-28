// soul/slashCommands/vcControls/leave.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Make the bot leave the voice channel.');
