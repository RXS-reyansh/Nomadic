// soul/events/player/queueEnd.ts
// Kazagumo event: 'playerEmpty' — fires when the queue is empty and playback stops
// Args: (player: KazagumoPlayer)
import logger from '../../console/logger.js';
import { sendInfo } from '../../components/statusMessages.js';
import { disableNowPlayingButtons, markMessageAsQueueEnd } from '../../helpers/nowPlayingManager.js';
import { scheduleRejoin } from '../../helpers/twentyFourSeven.js';

const REJOIN_DELAY_MS = 2 * 60 * 1000; // 2 minutes

export const name = 'playerEmpty';
export const type = 'player';

export async function execute(client: any, player: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  if (!guild) return;

  logger.info('PLAYER', `Queue ended in ${guild.name}`);

  await disableNowPlayingButtons(client, player).catch(() => {});
  markMessageAsQueueEnd(player.guildId);

  const channel = client.channels.cache.get(player.textId);
  if (channel) {
    const prefix = client.config?.prefix ?? '$$';
    await sendInfo(
      { channel },
      `Queue has ended. Use \`${prefix}play\` to add more songs.`,
    ).catch(() => {});
  }

  const is247 = await client.db?.get24Seven(player.guildId).catch((): null => null);

  if (is247?.enabled) {
    if (player.voiceId === is247.channelId) {
      // Bot is already in the 24/7 channel — just stay connected, do nothing
      logger.info('24-7', `Bot staying connected in 24/7 channel in ${guild.name}`);
    } else {
      // Bot is in a different channel — schedule a rejoin to the 24/7 channel after 2
      // minutes of inactivity. trackStart calls clearRejoin() so any new track started
      // (here OR after the user runs `play` in yet another channel) cancels this timer;
      // the next queueEnd will then reschedule a fresh 2-minute timer.
      logger.info('24-7', `Queue ended outside 24/7 channel in ${guild.name} — rejoining in 2 min`);
      scheduleRejoin(client, player.guildId, is247.channelId, REJOIN_DELAY_MS);
    }
  } else {
    // No 24/7 — start normal inactivity timer if implemented
    if (client.helpers?.startInactivityTimer) {
      client.helpers.startInactivityTimer(player.guildId, player.textId);
    }
  }

  if (client.helpers?.updateVoiceStatus) {
    await client.helpers.updateVoiceStatus(player).catch(() => {});
  }
}
