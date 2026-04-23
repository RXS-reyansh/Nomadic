// soul/events/player/playerDisconnect.ts
// Kazagumo event: 'playerDestroy' — fires when a player is destroyed
// Args: (player: KazagumoPlayer)
import logger from '../../console/logger.js';
import { clearPlayerState } from '../../helpers/nowPlayingManager.js';
import { clearRejoin } from '../../helpers/twentyFourSeven.js';

export const name = 'playerDestroy';
export const type = 'player';

export async function execute(client: any, player: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  const guildName = guild?.name || player.guildId;

  logger.info('PLAYER', `🛑 Player destroyed for ${guildName}`);

  // Clear all stored state (position snapshot, message reference) for this guild
  clearPlayerState(player.guildId);

  // Clear inactivity timer
  if (client.helpers?.cancelInactivityTimer) {
    client.helpers.cancelInactivityTimer(player.guildId);
  }

  // Cancel any pending 24/7 rejoin timer
  clearRejoin(player.guildId);

  // Clear voice channel status (Kazagumo: voiceId replaces voiceChannel)
  if (client.helpers?.clearVoiceStatus) {
    await client.helpers.clearVoiceStatus(player.voiceId);
  }
}
