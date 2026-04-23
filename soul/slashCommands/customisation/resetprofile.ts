// soul/slashCommands/customisation/resetprofile.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('resetprofile')
  .setDescription("Reset the bot's server profile (nickname, avatar, banner, bio) to global defaults.");
