// soul/slashCommands/vcControls/unmute.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Remove server-mute from a user in voice. Defaults to yourself.')
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .addUserOption(o =>
    o.setName('user')
      .setDescription('User to un-mute. Defaults to you.')
      .setRequired(false),
  );
