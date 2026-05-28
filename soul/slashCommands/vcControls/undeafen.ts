// soul/slashCommands/vcControls/undeafen.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('undeafen')
  .setDescription('Remove server-deafen from a user in voice. Defaults to yourself.')
  .setDefaultMemberPermissions(PermissionFlagsBits.DeafenMembers)
  .addUserOption(o =>
    o.setName('user')
      .setDescription('User to un-deafen. Defaults to you.')
      .setRequired(false),
  );
