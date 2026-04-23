// soul/events/player/trackEnd.ts
// Kazagumo event: 'playerEnd' — fires when a track ends
// Args: (player: KazagumoPlayer)  — NO track argument in Kazagumo
import logger from '../../console/logger.js';

export const name = 'playerEnd';
export const type = 'player';

export async function execute(client: any, player: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  if (!guild) return;

  logger.info('PLAYER', `⏹️ Track ended in ${guild.name}`);

  // Kazagumo: autoplay is stored in player.data; textId replaces textChannel
  const isAutoplay = player.data?.get('isAutoplay') ?? false;
  if (player.queue.length === 0 && !isAutoplay) {
    const is247 = await client.db?.get24Seven(player.guildId).catch((): null => null);
    if (!is247?.enabled && client.helpers?.startInactivityTimer) {
      client.helpers.startInactivityTimer(player.guildId, player.textId);
    }
  }
}
