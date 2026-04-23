// soul/slashCommands/info/help.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('View all commands or get details on a specific one.')
  .addStringOption(o =>
    o.setName('command')
      .setDescription('The command name to get detailed help for.')
      .setRequired(false),
  );
