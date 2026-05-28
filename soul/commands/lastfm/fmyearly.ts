// soul/commands/lastfm/fmyearly.ts
//
// Year-in-review style snapshot — top 5 artists, albums, tracks for the last
// 12 months.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  resolveTarget, parseLooseArgs, safeLinkLabel, fmt,
} from '../../helpers/lastfmHelpers.js';
import {
  isLastfmConfigured,
  userGetTopArtists,
  userGetTopAlbums,
  userGetTopTracks,
} from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmyearly',
  aliases: ['fmyear', 'fmyir'] as string[],
  description: "Yearly recap — top artists, albums, and tracks of the past year.",
  usage: `fmyearly
  fmyearly @user`,
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
    userGetTopArtists(target.lastfmUsername, '12month', 5),
    userGetTopAlbums(target.lastfmUsername, '12month', 5),
    userGetTopTracks(target.lastfmUsername, '12month', 5),
  ]);

  const arts: any[] = Array.isArray(artists?.artist) ? artists.artist : artists?.artist ? [artists.artist] : [];
  const alds: any[] = Array.isArray(albums?.album) ? albums.album : albums?.album ? [albums.album] : [];
  const trks: any[] = Array.isArray(tracks?.track) ? tracks.track : tracks?.track ? [tracks.track] : [];

  const lines = [
    `**Top artists**\n${arts.length
      ? arts.map((a, i) => `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url}) — \`${fmt(a.playcount)}\``).join('\n')
      : '*No data.*'}`,
    `**Top albums**\n${alds.length
      ? alds.map((a, i) => `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url}) — *${a.artist?.name ?? '—'}* — \`${fmt(a.playcount)}\``).join('\n')
      : '*No data.*'}`,
    `**Top tracks**\n${trks.length
      ? trks.map((t, i) => `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — *${t.artist?.name ?? '—'}* — \`${fmt(t.playcount)}\``).join('\n')
      : '*No data.*'}`,
  ];

  return message.reply(
    buildListPanel({
      title: `Yearly recap — ${target.lastfmUsername}`,
      lines,
      footer: '-# Last 12 months, via Last.fm.',
    }),
  );
}
