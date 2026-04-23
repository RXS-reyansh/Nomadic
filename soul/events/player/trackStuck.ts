// soul/events/player/trackStuck.ts
// Kazagumo event: 'playerStuck' — fires when a track gets stuck
// Args: (player: KazagumoPlayer, data: TrackStuckEvent)
// Note: no track arg — get it from player.queue.current
import logger from '../../console/logger.js';

export const name = 'playerStuck';
export const type = 'player';

export async function execute(client: any, player: any, data: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  const guildName = guild?.name || player.guildId;

  // Kazagumo: current track is player.queue.current; title is flat (no .info wrapper)
  const track = player.queue?.current;
  const trackTitle = track?.title ?? 'Unknown';

  logger.warn('PLAYER', `⚠️ Track stuck: ${trackTitle} in ${guildName} (threshold: ${data?.thresholdMs}ms)`);

  // Notify text channel (Kazagumo: player.textId)
  const channel = client.channels.cache.get(player.textId);
  if (channel) {
    await channel.send(`⚠️ **Track got stuck:** ${trackTitle}\nSkipping to next track...`).catch(() => {});
  }

  // Skip to next track (triggers playerEmpty if queue is empty)
  player.skip();
}
