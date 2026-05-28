// soul/slashCommands/utility/serverpurge.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverpurge')
  .setDescription('Bulk-delete messages matching a filter across the entire server.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand(sc =>
    sc.setName('text')
      .setDescription('Delete server-wide messages containing one or more search terms.')
      .addStringOption(o =>
        o.setName('terms')
          .setDescription('Quoted terms (up to 10): "hello" "world", or a single bare phrase.')
          .setRequired(true),
      ),
  )
  .addSubcommand(sc =>
    sc.setName('user')
      .setDescription("Delete every message from a specific user across the entire server.")
      .addUserOption(o =>
        o.setName('user').setDescription('Whose messages to delete.').setRequired(true),
      ),
  )
  .addSubcommand(sc =>
    sc.setName('bot').setDescription('Delete every bot message across the entire server.'),
  );
