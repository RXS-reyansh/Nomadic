// soul/slashCommands/vcControls/join.ts
import { SlashCommandBuilder, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Make the bot join a voice channel.')
  .addChannelOption(o =>
    o.setName('channel')
      .setDescription('Voice channel to join. Defaults to your VC, then the first VC in the server.')
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(false),
  );
