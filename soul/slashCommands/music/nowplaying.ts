// soul/slashCommands/music/nowplaying.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show the now playing message for the current track.');
