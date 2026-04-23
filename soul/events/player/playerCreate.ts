// soul/events/player/playerCreate.ts
// Kazagumo event: 'playerCreate' — fires when a player is created (same name as Riffy)
// Args: (player: KazagumoPlayer)
import logger from '../../console/logger.js';

export const name = 'playerCreate';
export const type = 'player';

export async function execute(client: any, player: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  if (!guild) return;

  logger.success('PLAYER', `✨ Player created for ${guild.name} (${guild.id})`);

  // Apply saved volume + cache it on the player so the now-playing panel can
  // tag the value as "(Server volume)" when it's still in use.
  if (client.db?.getGuildVolume) {
    const volume = await client.db.getGuildVolume(player.guildId);
    if (volume) {
      player.data?.set?.('serverVolume', volume);
      await player.setVolume(volume).catch((): null => null);
    }
  }

  // Update voice channel status
  if (client.helpers?.updateVoiceStatus) {
    await client.helpers.updateVoiceStatus(player);
  }
}
