// soul/commands/lastfm/fmcharts.ts
//
// Global Last.fm charts. Defaults to artists; pass `tracks` or `tags` to switch.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { safeLinkLabel, fmt } from '../../helpers/lastfmHelpers.js';
import {
  isLastfmConfigured,
  chartGetTopArtists,
  chartGetTopTracks,
  chartGetTopTags,
} from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmcharts',
  aliases: ['fmchart', 'fmglobal'] as string[],
  description: 'Show global Last.fm charts (artists / tracks / tags).',
  usage: `fmcharts
  fmcharts tracks
  fmcharts tags 25`,
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

  let mode: 'artists' | 'tracks' | 'tags' = 'artists';
  let limit = 10;
  for (const a of args) {
    const lower = a.toLowerCase();
    if (lower === 'tracks' || lower === 'track') mode = 'tracks';
    else if (lower === 'tags' || lower === 'tag') mode = 'tags';
    else if (lower === 'artists' || lower === 'artist') mode = 'artists';
    else if (/^\d+$/.test(lower)) {
      const n = parseInt(lower, 10);
      if (n > 0 && n <= 50) limit = n;
    }
  }

  if (mode === 'artists') {
    const data = await chartGetTopArtists(limit);
    const arr: any[] = Array.isArray(data?.artist) ? data.artist : [];
    if (!arr.length) return sendInfo(ctx, 'No chart data right now.');
    const lines = arr.map((a, i) => `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url}) — \`${fmt(a.listeners)}\` listeners`);
    return message.reply(buildListPanel({ title: 'Global top artists — Last.fm', lines }));
  }
  if (mode === 'tracks') {
    const data = await chartGetTopTracks(limit);
    const arr: any[] = Array.isArray(data?.track) ? data.track : [];
    if (!arr.length) return sendInfo(ctx, 'No chart data right now.');
    const lines = arr.map((t, i) => `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — *${t.artist?.name ?? '—'}* — \`${fmt(t.listeners)}\``);
    return message.reply(buildListPanel({ title: 'Global top tracks — Last.fm', lines }));
  }
  // tags
  const data = await chartGetTopTags(limit);
  const arr: any[] = Array.isArray(data?.tag) ? data.tag : [];
  if (!arr.length) return sendInfo(ctx, 'No chart data right now.');
  const lines = arr.map((t, i) => `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.wiki?.url ?? `https://www.last.fm/tag/${encodeURIComponent(t.name)}`}) — \`${fmt(t.taggings)}\` taggings`);
  return message.reply(buildListPanel({ title: 'Global top tags — Last.fm', lines }));
}
