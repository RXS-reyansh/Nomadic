// soul/events/player/trackStuck.ts
// Kazagumo event: 'playerStuck' — fires when Lavalink can't push out audio
// frames for a track for longer than its configured threshold (10s by default).
//
// Behaviour:
//   1. If the stuck track was itself a previous auto-retry (`_autoRetried`),
//      send the orange "unrecoverable" panel and skip — no second retry.
//   2. Otherwise, kick off the alert send AND the alternate-source resolve
//      *in parallel* (the channel.send doesn't need to settle before we start
//      hitting Lavalink REST), then once the resolve returns we either:
//         • play the alternate via `player.play(retry, { replaceCurrent: true })`
//           and edit the panel to green "Recovered after stall", or
//         • edit the panel to orange "unrecoverable" and skip.
//
// All user-facing messages are Components V2 panels from playerAlerts.ts.
// Recovery latency target: ≤ ~200ms once the alternate is resolved (single
// playTrack roundtrip, no skip→end→play cascade).

import logger from '../../console/logger.js';
import {
  buildTrackRecoveredPayload,
  buildTrackStuckRetryingPayload,
  buildTrackUnrecoverablePayload,
  type StuckTrackInfo,
} from '../../components/playerAlerts.js';
import {
  pickRetrySource,
  resolveAndInjectAlternate,
} from '../../helpers/playerRetry.js';

export const name = 'playerStuck';
export const type = 'player';

export async function execute(client: any, player: any, data: any): Promise<void> {
  const guild = client.guilds.cache.get(player.guildId);
  const guildName = guild?.name || player.guildId;

  const track = player.queue?.current;
  if (!track) {
    logger.warn('PLAYER', `⚠️ Stuck event with no current track in ${guildName}`);
    return;
  }

  const trackInfo: StuckTrackInfo = {
    title: track.title ?? 'Unknown',
    author: track.author,
    url: track.uri,
    thumbnail: track.thumbnail,
    sourceName: track.sourceName,
  };

  logger.warn(
    'PLAYER',
    `⚠️ Track stuck: ${trackInfo.title} in ${guildName} (threshold: ${data?.thresholdMs}ms, source: ${trackInfo.sourceName ?? 'unknown'})`,
  );

  const channel = client.channels.cache.get(player.textId);

  // ── Already retried once → don't loop, just skip with notice.
  if (track._autoRetried) {
    if (channel) {
      await (channel as any)
        .send(
          buildTrackUnrecoverablePayload(
            trackInfo,
            'Already auto-recovered once — second stall, giving up on this track.',
          ),
        )
        .catch((): null => null);
    }
    player.skip();
    return;
  }

  const retrySource = pickRetrySource(trackInfo.sourceName);

  // Fire the alert send AND the alternate-resolve in parallel — neither
  // depends on the other settling first.
  const sendAlertPromise: Promise<any> = channel
    ? (channel as any)
        .send(buildTrackStuckRetryingPayload(trackInfo, retrySource))
        .catch((): null => null)
    : Promise.resolve(null);

  const retryPromise = resolveAndInjectAlternate(client, player, track, retrySource);

  const [alertMessage, retryTrack] = await Promise.all([sendAlertPromise, retryPromise]);

  if (!retryTrack) {
    const failPayload = buildTrackUnrecoverablePayload(trackInfo);
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
