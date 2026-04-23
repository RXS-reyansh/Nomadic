// soul/slashCommands/music/247.ts
import { SlashCommandBuilder, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('24-7')
  .setDescription('Manage 24/7 mode — keep the bot permanently connected to a voice channel.')
  .addSubcommand(sub =>
    sub
      .setName('enable')
      .setDescription('Enable 24/7 mode in a voice channel (defaults to current VC if none given).')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Voice channel to stay in 24/7 (uses current VC if not specified).')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildVoice),
      ),
  )
  .addSubcommand(sub =>
    sub
      .setName('disable')
      .setDescription('Disable 24/7 mode in this server.'),
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('See which channel is currently set for 24/7 mode.'),
  );
