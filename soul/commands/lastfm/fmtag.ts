// soul/commands/lastfm/fmtag.ts
//
// Show top artists/tracks/albums for a given Last.fm tag (genre).

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { safeLinkLabel } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import {
  isLastfmConfigured,
  tagGetTopArtists,
  tagGetTopTracks,
  tagGetTopAlbums,
} from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmtag',
  aliases: ['fmgenre'] as string[],
  description: 'Show top artists, tracks and albums for a Last.fm tag/genre.',
  usage: 'fmtag <tag>',
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
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);

  const tag = args.join(' ').trim();
  const [artists, tracks, albums] = await Promise.all([
    tagGetTopArtists(tag, 5),
    tagGetTopTracks(tag, 5),
    tagGetTopAlbums(tag, 5),
  ]);

  const arts: any[] = Array.isArray(artists?.artist) ? artists.artist : [];
  const trks: any[] = Array.isArray(tracks?.track) ? tracks.track : [];
  const alds: any[] = Array.isArray(albums?.album) ? albums.album : [];

  if (!arts.length && !trks.length && !alds.length) {
    return sendInfo(ctx, `No data found for tag \`${tag}\`.`);
  }

  const lines = [
    `**Top artists**\n${arts.length
      ? arts.map((a, i) => `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url})`).join('\n')
      : '*No data.*'}`,
    `**Top tracks**\n${trks.length
      ? trks.map((t, i) => `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — *${t.artist?.name ?? '—'}*`).join('\n')
      : '*No data.*'}`,
    `**Top albums**\n${alds.length
      ? alds.map((a, i) => `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url}) — *${a.artist?.name ?? '—'}*`).join('\n')
      : '*No data.*'}`,
  ];

  return message.reply(
    buildListPanel({
      title: `Tag: ${tag}`,
      lines,
      footer: `-# [Open on Last.fm](https://www.last.fm/tag/${encodeURIComponent(tag)})`,
    }),
  );
}
