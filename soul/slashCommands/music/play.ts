// soul/slashCommands/music/play.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song or add it to the queue.')
  .addStringOption(option =>
    option
      .setName('song')
      .setDescription('Song name or URL to play.')
      .setRequired(true),
  );
