// soul/commands/lastfm/fmweekly.ts
//
// Shows weekly artist + album + track top-3 in a single panel — quick recap
// of the last 7 days.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  resolveTarget, parseLooseArgs, safeLinkLabel, fmt,
} from '../../helpers/lastfmHelpers.js';
import {
  isLastfmConfigured,
  userGetWeeklyArtistChart,
  userGetWeeklyAlbumChart,
  userGetWeeklyTrackChart,
} from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmweekly',
  aliases: ['fmweek'] as string[],
  description: "Weekly recap — top artists, albums, and tracks for the last 7 days.",
  usage: `fmweekly
  fmweekly @user`,
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

  const [artists, albums, tracks] = await Promise.all([
    userGetWeeklyArtistChart(target.lastfmUsername),
    userGetWeeklyAlbumChart(target.lastfmUsername),
    userGetWeeklyTrackChart(target.lastfmUsername),
  ]);

  const arts: any[] = (Array.isArray(artists?.artist) ? artists.artist : artists?.artist ? [artists.artist] : []).slice(0, 5);
  const alds: any[] = (Array.isArray(albums?.album) ? albums.album : albums?.album ? [albums.album] : []).slice(0, 5);
  const trks: any[] = (Array.isArray(tracks?.track) ? tracks.track : tracks?.track ? [tracks.track] : []).slice(0, 5);

  const block = (label: string, items: string[]): string =>
    `**${label}**\n${items.length ? items.join('\n') : '*Nothing this week.*'}`;

  const lines = [
    block(
      'Top artists',
      arts.map((a, i) => `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url}) — \`${fmt(a.playcount)}\``),
    ),
    block(
      'Top albums',
      alds.map((a, i) => `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url}) — *${a.artist?.['#text'] ?? '—'}* — \`${fmt(a.playcount)}\``),
    ),
    block(
      'Top tracks',
      trks.map((t, i) => `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — *${t.artist?.['#text'] ?? '—'}* — \`${fmt(t.playcount)}\``),
    ),
  ];

  return message.reply(
    buildListPanel({
      title: `Weekly recap — ${target.lastfmUsername}`,
      lines,
      footer: '-# Last 7 days, via Last.fm.',
    }),
  );
}
