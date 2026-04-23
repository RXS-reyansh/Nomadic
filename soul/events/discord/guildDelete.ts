import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'guildDelete';
export const type = 'discord';

export async function execute(_client: any, guild: any): Promise<void> {
  logger.warn('GUILD', `Left guild: ${guild.name} (${guild.id})`);

  // Clean up database
  if (_client.db?.deleteGuild) {
    await _client.db.deleteGuild(guild.id).catch(() => {});
  }

  // Destroy player if one exists (Kazagumo)
  const player = _client.kazagumo.players.get(guild.id) as any;
  if (player) await player.destroy().catch((): null => null);

  webhookLogger.logGuildLeave(guild);
}
