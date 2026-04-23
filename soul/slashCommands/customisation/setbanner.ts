// soul/slashCommands/customisation/setbanner.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setbanner')
  .setDescription("Change the bot's server banner.")
  .addAttachmentOption(o =>
    o.setName('image')
      .setDescription('The new banner image (PNG, JPG, GIF, WEBP).')
      .setRequired(false),
  )
  .addBooleanOption(o =>
    o.setName('reset')
      .setDescription('Reset to global banner instead of setting a new one.')
      .setRequired(false),
  );
