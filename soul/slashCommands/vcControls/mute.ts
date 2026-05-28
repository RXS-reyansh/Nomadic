// soul/slashCommands/vcControls/mute.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Server-mute a user in voice. Defaults to yourself.')
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
  .addUserOption(o =>
    o.setName('user')
      .setDescription('User to server-mute. Defaults to you.')
      .setRequired(false),
  );
