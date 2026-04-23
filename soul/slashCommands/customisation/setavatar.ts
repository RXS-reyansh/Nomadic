// soul/slashCommands/customisation/setavatar.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setavatar')
  .setDescription("Change the bot's server avatar.")
  .addAttachmentOption(o =>
    o.setName('image')
      .setDescription('The new avatar image (PNG, JPG, GIF, WEBP).')
      .setRequired(false),
  )
  .addBooleanOption(o =>
    o.setName('reset')
      .setDescription('Reset to global avatar instead of setting a new one.')
      .setRequired(false),
  );
