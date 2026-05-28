import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError } from '../../components/statusMessages.js';
import { clearPlayerState } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'rejoin',
  aliases: [] as string[],
  description: 'Make the bot leave and rejoin its current voice channel.',
  usage: 'rejoin',
  category: 'vcControls',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: ['Connect', 'Speak'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 10,
};

async function handle(
  ctx: any,
  client: HermacaClient,
  guild: any,
  textChannelId: string,
) {
  const player: any = client.kazagumo.players.get(guild.id);
  if (!player) {
    const guildPrefix: string =
      (await client.helpers.getGuildPrefix?.(guild.id).catch((): null => null)) ??
      client.config.prefix;
    return sendError(
      ctx,
      `I am not in any voice channel. Use \`${guildPrefix}join\` (or \`/join\`) to make me join one.`,
    );
  }

  const voiceChannelId: string = player.voiceId;
  const voiceChannel = guild.channels.cache.get(voiceChannelId);

  if (!voiceChannel?.isVoiceBased?.()) {
    return sendError(ctx, 'The previous voice channel no longer exists or is invalid.');
  }

  const botMember = guild.members.me;
  const perms = voiceChannel.permissionsFor(botMember);
  if (!perms?.has('Connect') || !perms?.has('Speak')) {
    return sendError(ctx, `I don't have permission to rejoin <#${voiceChannelId}>.`);
  }

  await player.destroy().catch((): null => null);
  clearPlayerState(guild.id);

  await new Promise<void>(resolve => setTimeout(resolve, 500));

  await client.kazagumo.createPlayer({
    guildId: guild.id,
    voiceId: voiceChannelId,
    textId: textChannelId,
    deaf: true,
  }).catch((): null => null);

  return sendSuccess(ctx, `Rejoined <#${voiceChannelId}>.`);
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  return handle({ message }, client, message.guild, message.channel.id);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const ctx = { interaction };
  if (!interaction.guild) return sendError(ctx, 'This command can only be used in a server.');
  return handle(ctx, client, interaction.guild, interaction.channelId);
}
