// soul/events/player/trackError.ts
// Kazagumo event: 'playerException' — fires when an exception occurs during playback
// Args: (player: KazagumoPlayer, data: TrackExceptionEvent)
// Note: no track arg — get it from player.queue.current
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'playerException';
export const type = 'player';

export async function execute(client: any, player: any, data: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  const guildName = guild?.name || player.guildId;

  // Kazagumo: current track is player.queue.current; title is flat (no .info wrapper)
  const track = player.queue?.current;
  const trackTitle = track?.title ?? 'Unknown';
  const errorMsg = data?.exception?.message || data?.message || 'Unknown error';

  logger.error('PLAYER', `❌ Track exception: ${trackTitle} in ${guildName} - ${errorMsg}`);

  // Notify text channel (Kazagumo: player.textId)
  const channel = client.channels.cache.get(player.textId);
  if (channel) {
    await channel.send(`❌ **Error playing track:** ${trackTitle}\nReason: ${errorMsg}`).catch(() => {});
  }

  // Skip to next track if queue has items, otherwise skip (triggers playerEmpty)
  player.skip();

  webhookLogger.logError(new Error(`Track exception: ${trackTitle} - ${errorMsg}`), 'Kazagumo Player');
}
