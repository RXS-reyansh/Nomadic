// soul/slashCommands/utility/avatar.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription("View a user's, the bot's, or the server's avatar.")
  .addUserOption(o =>
    o.setName('user')
      .setDescription('The user whose avatar to view.')
      .setRequired(false),
  )
  .addStringOption(o =>
    o.setName('target')
      .setDescription('View a special target avatar.')
      .setRequired(false)
      .addChoices(
        { name: 'Bot', value: 'bot' },
        { name: 'Server Icon', value: 'server' },
      ),
  );
