// soul/slashCommands/customisation/setprefix.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setprefix')
  .setDescription("Change the bot's command prefix for this server.")
  .addStringOption(o =>
    o.setName('new_prefix')
      .setDescription('The new prefix (max 10 characters).')
      .setRequired(true),
  );
