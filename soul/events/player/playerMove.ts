// soul/events/player/playerMove.ts
// Kazagumo event: 'playerMoved' — fires when the bot moves, joins, or leaves a voice channel
// Args: (player: KazagumoPlayer, state: PlayerMovedState, channels: PlayerMovedChannels)
import logger from '../../console/logger.js';

export const name = 'playerMoved';
export const type = 'player';

export async function execute(client: any, player: any, _state: any, channels: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  const guildName = guild?.name || player.guildId;

  const oldChannel = channels?.oldChannel?.name || 'unknown';
  const newChannel = channels?.newChannel?.name || 'unknown';

  logger.info('PLAYER', `🔄 Player moved for ${guildName}: ${oldChannel} → ${newChannel}`);
}
