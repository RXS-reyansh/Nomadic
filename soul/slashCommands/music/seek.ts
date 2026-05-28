// soul/slashCommands/music/seek.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Seek to a specific position in the current track.')
  .addStringOption((option) =>
    option
      .setName('time')
      .setDescription('Position to seek to (e.g. 1:45, 1m 45s, 105s).')
      .setRequired(true),
  );
