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

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const statusCtx = { message };
  const guild = message.guild;

  // Kazagumo: kazagumo.players.get() instead of riffy.players.get()
  const player: any = client.kazagumo.players.get(guild.id);
  if (!player) {
    const guildPrefix: string =
      (await client.helpers.getGuildPrefix?.(guild.id).catch((): null => null)) ??
      client.config.prefix;
    return sendError(
      statusCtx,
      `I am not in any voice channel. Use \`${guildPrefix}join\` to make me join one.`,
    );
  }

  // Kazagumo: voiceId replaces voiceChannel
  const voiceChannelId: string = player.voiceId;
  const voiceChannel = guild.channels.cache.get(voiceChannelId);

  if (!voiceChannel?.isVoiceBased?.()) {
    return sendError(statusCtx, 'The previous voice channel no longer exists or is invalid.');
  }

  const botMember = guild.members.me;
  const perms = voiceChannel.permissionsFor(botMember);
  if (!perms?.has('Connect') || !perms?.has('Speak')) {
    return sendError(statusCtx, `I don't have permission to rejoin <#${voiceChannelId}>.`);
  }

  // Kazagumo: destroy() is async and fully cleans up the player
  await player.destroy().catch((): null => null);
  clearPlayerState(guild.id);

  await new Promise<void>(resolve => setTimeout(resolve, 500));

  // Kazagumo: createPlayer() is async; uses voiceId/textId instead of voiceChannel/textChannel
  await client.kazagumo.createPlayer({
    guildId: guild.id,
    voiceId: voiceChannelId,
    textId: message.channel.id,
    deaf: true,
  }).catch((): null => null);

  return sendSuccess(statusCtx, `Rejoined <#${voiceChannelId}>.`);
}
