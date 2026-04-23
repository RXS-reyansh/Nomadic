// soul/slashCommands/customisation/setname.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setname')
  .setDescription("Change the bot's nickname in this server. Leave blank to reset.")
  .addStringOption(o =>
    o.setName('nickname')
      .setDescription('New nickname (max 32 characters). Leave blank to reset to global username.')
      .setRequired(false),
  );
