import logger from '../../console/logger.js';
import { scheduleRejoin } from '../../helpers/twentyFourSeven.js';

export const name = 'voiceStateUpdate';
export const type = 'discord';

export async function execute(client: any, oldState: any, newState: any): Promise<void> {
  const member = newState.member || oldState.member;
  if (member?.id !== client.user?.id) return;

  const guildId = newState.guild.id;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;

  // Bot disconnected
  if (oldChannel && !newChannel) {
    logger.info('VOICE', `Disconnected from ${oldChannel.name} in ${guildId}`);
    const player = client.kazagumo.players.get(guildId) as any;
    if (player) await player.destroy().catch((): null => null);

    // 24/7 reconnection attempt
    if (client.db) {
      const settings = await client.db.get24Seven(guildId).catch((): null => null);
      if (settings?.enabled) {
        scheduleRejoin(client, guildId, settings.channelId, 2000);
      }
    }
    return;
  }

  // Bot joined or moved
  if (!oldChannel && newChannel) {
    logger.success('VOICE', `Connected to ${newChannel.name} in ${guildId}`);
  }

  if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
    logger.info('VOICE', `Moved from ${oldChannel.name} to ${newChannel.name}`);
  }

  // Enforce server deafen
  if (!newState.serverDeaf && member.id === client.user.id) {
    await newState.setDeaf(true).catch(() => {});
  }
}
