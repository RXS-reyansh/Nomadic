// soul/events/player/trackStart.ts
// Kazagumo event: 'playerStart' — fires when a track begins playing
// Args: (player: KazagumoPlayer, track: KazagumoTrack)
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';
import { deleteOldNowPlayingMessage, sendNowPlayingMessage } from '../../helpers/nowPlayingManager.js';
import { clearRejoin } from '../../helpers/twentyFourSeven.js';

export const name = 'playerStart';
export const type = 'player';

export async function execute(client: any, player: any, track: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  if (!guild) return;

  if (client.helpers?.cancelInactivityTimer) {
    client.helpers.cancelInactivityTimer(player.guildId);
  }

  // Cancel any pending 24/7 rejoin timer (a new track started before the rejoin fired)
  clearRejoin(player.guildId);

  // Kazagumo: track is flat — no .info wrapper
  logger.info('PLAYER', `🎵 Now playing: ${track.title} by ${track.author} in ${guild.name}`);

  // Delete the previous now playing message (skipped if it was a queue-end message)
  await deleteOldNowPlayingMessage(client, player.guildId);

  await sendNowPlayingMessage(client, player, track).catch((err: any) => {
    logger.error('NOWPLAYING', `Failed to send now playing: ${err.message}`);
    if (err.rawError) logger.error('NOWPLAYING', `API error detail: ${JSON.stringify(err.rawError)}`);
    if (err.errors) logger.error('NOWPLAYING', `Validation errors: ${JSON.stringify(err.errors)}`);
  });

  if (client.db?.recordSongPlay && track.requester) {
    await client.db.recordSongPlay((track.requester as any).id, track).catch((err: Error) => {
      logger.error('DB', `Failed to record song play: ${err.message}`);
    });
  }

  if (client.db?.incrementGlobalSongsPlayed) {
    client.db.incrementGlobalSongsPlayed().catch((): null => null);
  }

  if (client.helpers?.updateVoiceStatus) {
    await client.helpers.updateVoiceStatus(player);
  }

  webhookLogger.logTrackStart(guild, track);
}
