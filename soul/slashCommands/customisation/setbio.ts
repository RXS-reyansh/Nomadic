// soul/slashCommands/customisation/setbio.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setbio')
  .setDescription("Set the bot's server profile bio (max 190 characters).")
  .addStringOption(o =>
    o.setName('text')
      .setDescription("Bio text. Use \\n for line breaks. Type 'reset' to clear the bio.")
      .setRequired(true)
      .setMaxLength(300),
  );
