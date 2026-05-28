// soul/slashCommands/utility/membercount.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('membercount')
  .setDescription("Show the server's member count breakdown.")
  .addStringOption(o =>
    o.setName('guild_id')
      .setDescription('Look up another server by ID. (Developer-only — ignored otherwise.)')
      .setRequired(false),
  );
