// soul/slashCommands/vcControls/shift.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('shift')
  .setDescription("Move a user to another voice channel. Defaults to yourself \u2192 bot's channel.")
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
  .addUserOption(o =>
    o.setName('user')
      .setDescription('User to move. Defaults to you.')
      .setRequired(false),
  )
  .addChannelOption(o =>
    o.setName('channel')
      .setDescription("Destination voice channel. Defaults to the bot's channel, then the first VC.")
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(false),
  );
