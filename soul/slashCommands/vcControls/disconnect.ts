// soul/slashCommands/vcControls/disconnect.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('disconnect')
  .setDescription('Disconnect a user from their voice channel. Defaults to yourself.')
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
  .addUserOption(o =>
    o.setName('user')
      .setDescription('User to disconnect. Defaults to you.')
      .setRequired(false),
  );
