import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError } from '../../components/statusMessages.js';
import { disableNowPlayingButtons, clearPlayerState } from '../../helpers/nowPlayingManager.js';
import { scheduleRejoin } from '../../helpers/twentyFourSeven.js';

export const options = {
  name: 'leave',
  aliases: [] as string[],
  description: 'Make the bot leave the voice channel.',
  usage: 'leave',
  category: 'vcControls',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const statusCtx = { message };
  const guild = message.guild;

  // Kazagumo: kazagumo.players.get() instead of riffy.players.get()
  const player: any = client.kazagumo.players.get(guild.id);
  if (!player) return sendError(statusCtx, 'I am not in any voice channel.');

  // Kazagumo: voiceId replaces voiceChannel
  const channelId: string = player.voiceId;

  await disableNowPlayingButtons(client, player).catch((): null => null);
  // Kazagumo: player.destroy() is async — handles queue clear, stop, and disconnect
  await player.destroy().catch((): null => null);
  clearPlayerState(guild.id);

  // 24/7 rejoin: if 24/7 is enabled for this guild, schedule a rejoin to the
  // configured channel. We do this explicitly here because the playerDestroy
  // event handler calls clearRejoin(), which would cancel any rejoin scheduled
  // by the voiceStateUpdate handler. Scheduling here (after destroy resolves)
  // guarantees the rejoin survives.
  const settings = await client.db?.get24Seven(guild.id).catch((): null => null);
  if (settings?.enabled) {
    scheduleRejoin(client, guild.id, settings.channelId, 2000);
    return sendSuccess(
      statusCtx,
      `Left <#${channelId}>. Rejoining 24/7 channel <#${settings.channelId}> shortly.`,
    );
  }

  return sendSuccess(statusCtx, `Left <#${channelId}>.`);
}
