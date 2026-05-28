// soul/events/player/trackError.ts
// Kazagumo event: 'playerException' — fires when Lavalink raises an exception
// while streaming a track (broken stream, source returned an error mid-play, etc).
// Args: (player: KazagumoPlayer, data: TrackExceptionEvent)
//
// Same one-shot, parallel-resolve auto-recovery as trackStuck.ts. The shared
// `_autoRetried` flag means a stuck-then-error or error-then-stuck chain still
// terminates after one retry total.

import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';
import {
  buildTrackErrorPayload,
  buildTrackRecoveredPayload,
  buildTrackStuckRetryingPayload,
  type StuckTrackInfo,
} from '../../components/playerAlerts.js';
import {
  pickRetrySource,
  resolveAndInjectAlternate,
} from '../../helpers/playerRetry.js';

export const name = 'playerException';
export const type = 'player';

export async function execute(client: any, player: any, data: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  const guildName = guild?.name || player.guildId;

  const track = player.queue?.current;
  const trackTitle = track?.title ?? 'Unknown';
  const errorMsg = data?.exception?.message || data?.message || 'Unknown error';

  logger.error('PLAYER', `❌ Track exception: ${trackTitle} in ${guildName} - ${errorMsg}`);
  webhookLogger.logError(
    new Error(`Track exception: ${trackTitle} - ${errorMsg}`),
    'Kazagumo Player',
  );

  const channel = client.channels.cache.get(player.textId);
  const trackInfo: StuckTrackInfo = track
    ? {
        title: trackTitle,
        author: track.author,
        url: track.uri,
        thumbnail: track.thumbnail,
        sourceName: track.sourceName,
      }
    : { title: trackTitle };

  // ── Already retried once for this track → no second retry. Send error panel + skip.
  if (!track || track._autoRetried) {
    if (channel) {
      await (channel as any)
        .send(buildTrackErrorPayload(trackInfo, errorMsg))
        .catch((): null => null);
    }
    player.skip();
    return;
  }

  const retrySource = pickRetrySource(trackInfo.sourceName);

  // Fire alert send AND alternate-resolve in parallel.
  const sendAlertPromise: Promise<any> = channel
    ? (channel as any)
        .send(buildTrackStuckRetryingPayload(trackInfo, retrySource))
        .catch((): null => null)
    : Promise.resolve(null);

  const retryPromise = resolveAndInjectAlternate(client, player, track, retrySource);

  const [alertMessage, retryTrack] = await Promise.all([sendAlertPromise, retryPromise]);

  if (!retryTrack) {
    const failPayload = buildTrackErrorPayload(trackInfo, errorMsg);
    if (alertMessage?.editable) {
      await alertMessage.edit(failPayload).catch((): null => null);
    } else if (channel) {
      await (channel as any).send(failPayload).catch((): null => null);
    }
    player.skip();
    return;
  }

  const successPayload = buildTrackRecoveredPayload(
    {
      ...trackInfo,
      thumbnail: retryTrack.thumbnail ?? trackInfo.thumbnail,
      url: retryTrack.uri ?? trackInfo.url,
    },
    retrySource,
  );

  if (alertMessage?.editable) {
    await alertMessage.edit(successPayload).catch((): null => null);
  } else if (channel) {
    await (channel as any).send(successPayload).catch((): null => null);
  }
}
