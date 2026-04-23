// soul/slashCommands/utility/banner.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('banner')
  .setDescription("View a user's, the bot's, or the server's banner.")
  .addUserOption(o =>
    o.setName('user')
      .setDescription('The user whose banner to view.')
      .setRequired(false),
  )
  .addStringOption(o =>
    o.setName('target')
      .setDescription('View a special target banner.')
      .setRequired(false)
      .addChoices(
        { name: 'Bot', value: 'bot' },
        { name: 'Server Banner', value: 'server' },
      ),
  );
