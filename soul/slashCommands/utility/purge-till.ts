// soul/slashCommands/utility/purge-till.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge-till')
  .setDescription('Delete messages in this channel that were sent after a target message.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o =>
    o.setName('target')
      .setDescription('Target message: ID or full Discord message link (must be in this channel).')
      .setRequired(true),
  )
  .addIntegerOption(o =>
    o.setName('count')
      .setDescription('Max number of messages after the target to delete. Omit for all.')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(1000),
  );
