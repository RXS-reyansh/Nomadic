// soul/slashCommands/info/debug.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('debug')
  .setDescription('Display a detailed multi-page stats menu for the bot.');
