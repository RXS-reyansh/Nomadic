// soul/events/player/playerUpdate.ts
// Kazagumo event: 'playerUpdate' — fires frequently with position updates
// Args: (player: KazagumoPlayer, data: PlayerUpdate)
import logger from '../../console/logger.js';
import { setPositionSnapshot } from '../../helpers/nowPlayingManager.js';

export const name = 'playerUpdate';
export const type = 'player';

export async function execute(client: any, player: any, data: any): Promise<void> {
  if (client.config?.debug) {
    logger.debug('PLAYER', `Player update for ${player.guildId}: position ${data?.state?.position || 0}`);
  }

  // Store the exact position and timestamp so progress can be interpolated between updates
  const reportedPosition = data?.state?.position ?? 0;
  setPositionSnapshot(player.guildId, reportedPosition);

  // Update voice channel status if configured
  if (client.helpers?.updateVoiceStatus && reportedPosition % 30000 === 0) {
    await client.helpers.updateVoiceStatus(player);
  }
}
