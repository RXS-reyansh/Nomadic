// soul/helpers/twentyFourSeven.ts
// In-memory registry for pending 24/7 rejoin timers (guildId → timeout handle)
import logger from '../console/logger.js';

const rejoinTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleRejoin(client: any, guildId: string, channelId: string, delayMs: number): void {
  clearRejoin(guildId);
  logger.info('24-7', `Scheduled rejoin to <${channelId}> in ${delayMs / 1000}s for guild ${guildId}`);
  const timer = setTimeout(async () => {
    rejoinTimers.delete(guildId);
    await performRejoin(client, guildId, channelId);
  }, delayMs);
  rejoinTimers.set(guildId, timer);
}

export function clearRejoin(guildId: string): void {
  const timer = rejoinTimers.get(guildId);
  if (timer !== undefined) {
    clearTimeout(timer);
    rejoinTimers.delete(guildId);
    logger.info('24-7', `Cancelled pending rejoin for guild ${guildId}`);
  }
}

async function performRejoin(client: any, guildId: string, channelId: string): Promise<void> {
  const guild = client.guilds?.cache?.get(guildId);
  if (!guild) return;

  const channel = guild.channels?.cache?.get(channelId);
  if (!channel || !channel.isVoiceBased()) return;

  const existingPlayer = client.kazagumo?.players?.get(guildId);
  if (existingPlayer) {
    await existingPlayer.destroy().catch((): null => null);
  }

  try {
    await client.kazagumo.createPlayer({
      guildId,
      voiceId: channelId,
      textId: guild.systemChannelId || channelId,
      deaf: true,
    });
    logger.success('24-7', `Rejoined 24/7 channel in ${guild.name}`);
  } catch (err) {
    logger.error('24-7', `Rejoin failed for ${guild.name}: ${(err as Error).message}`);
  }
}
