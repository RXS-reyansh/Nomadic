// soul/slashCommands/customisation/resetprefix.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('resetprefix')
  .setDescription("Remove this server's custom prefix and revert to the global prefix.");
