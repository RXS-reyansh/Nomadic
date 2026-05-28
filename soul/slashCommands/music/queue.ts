// soul/slashCommands/music/queue.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the full queue: completed, now playing, and upcoming.')
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Optional page number to open (defaults to the page with the now-playing track).')
      .setMinValue(1)
      .setRequired(false),
  );
