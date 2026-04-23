import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Set your Away from Keyboard status.')
  .addStringOption(o =>
    o.setName('text')
      .setDescription('Optional AFK reason. Supports \\n and $emoji<name_or_id>.')
      .setRequired(false),
  )
  .addAttachmentOption(o =>
    o.setName('image')
      .setDescription('Optional AFK image.')
      .setRequired(false),
  );