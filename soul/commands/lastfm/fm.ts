// soul/commands/lastfm/fm.ts
//
// "Now scrobbling" — shows the user's currently playing track if Last.fm
// reports `nowplaying=true`, otherwise their most recent scrobble. Optional
// arg lets you peek at someone else's nowplaying.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { resolveTarget, parseLooseArgs, uts } from '../../helpers/lastfmHelpers.js';
import {
  isLastfmConfigured,
  userGetRecentTracks,
  userGetInfo,
  trackGetInfo,
} from '../../helpers/lastfmClient.js';
import { buildNowScrobbling } from '../../components/lastfm.js';

export const options = {
  name: 'fm',
  aliases: ['nowscrobbling', 'np-fm'] as string[],
  description: "Show what you (or someone else) are scrobbling on Last.fm right now.",
  usage: `fm
  fm @user`,
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!isLastfmConfigured()) {
    return sendError(ctx, 'Last.fm integration is not configured on this bot. Please ask the developer.');
  }

  const { userArg } = parseLooseArgs(args);
  const target = await resolveTarget(client, message.guild, message.author, userArg);
  if (!target.lastfmUsername) {
    return sendInfo(
      ctx,
      target.isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.discordUser.username}** hasn't linked a Last.fm account.`,
    );
  }

  const recent = await userGetRecentTracks(target.lastfmUsername, 1);
  const tracks: any[] = Array.isArray(recent?.track)
    ? recent.track
    : recent?.track
      ? [recent.track]
      : [];
  if (!tracks.length) {
    return sendInfo(ctx, `**${target.lastfmUsername}** hasn't scrobbled anything yet.`);
  }

  const t = tracks[0];
  const isLive = t['@attr']?.nowplaying === 'true';
  const artistName: string = typeof t.artist === 'string' ? t.artist : t.artist?.['#text'] ?? t.artist?.name ?? 'Unknown artist';
  const albumName: string | null = t.album?.['#text'] || null;
  const image = (t.image ?? []).slice().reverse().find((i: any) => i?.['#text'])?.['#text'] || null;

  const [info, trackInfo] = await Promise.all([
    userGetInfo(target.lastfmUsername),
    trackGetInfo(artistName, t.name, target.lastfmUsername),
  ]);

  const userPlayCount = trackInfo?.userplaycount ? parseInt(trackInfo.userplaycount, 10) : null;
  const totalScrobbles = info?.playcount ? parseInt(info.playcount, 10) : null;
  const scrobbledAt = !isLive && t.date?.uts ? uts(t.date.uts) : null;

  return message.reply(
    buildNowScrobbling({
      username: target.lastfmUsername,
      isLive,
      trackName: t.name ?? 'Unknown track',
      trackUrl: t.url ?? `https://www.last.fm/user/${encodeURIComponent(target.lastfmUsername)}`,
      artist: artistName,
      album: albumName,
      imageUrl: image,
      userPlayCount,
      totalScrobbles,
      scrobbledAt,
    }),
  );
}
