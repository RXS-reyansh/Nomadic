// soul/commands/lastfm/fmgeo.ts
//
// Top artists or tracks for a country. Country must be a name Last.fm
// recognises (English): "United States", "Japan", "Brazil", etc.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { safeLinkLabel, fmt } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, geoGetTopArtists, geoGetTopTracks } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmgeo',
  aliases: ['fmcountry'] as string[],
  description: 'Top artists or tracks for a country on Last.fm.',
  usage: `fmgeo <country>
  fmgeo tracks <country>`,
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

  let mode: 'artists' | 'tracks' = 'artists';
  let rest = args.slice();
  if (rest[0]?.toLowerCase() === 'tracks' || rest[0]?.toLowerCase() === 'track') {
    mode = 'tracks';
    rest = rest.slice(1);
  } else if (rest[0]?.toLowerCase() === 'artists' || rest[0]?.toLowerCase() === 'artist') {
    rest = rest.slice(1);
  }
  const country = rest.join(' ').trim();
  if (!country) return sendWrongUsage({ message, client }, options.name, options.usage);

  if (mode === 'artists') {
    const data = await geoGetTopArtists(country, 10);
    const arr: any[] = Array.isArray(data?.artist) ? data.artist : [];
    if (!arr.length) return sendInfo(ctx, `No data for country \`${country}\`. Use the English name (e.g. "United States").`);
    const lines = arr.map((a, i) => `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url}) — \`${fmt(a.listeners)}\` listeners`);
    return message.reply(buildListPanel({ title: `Top artists in ${country}`, lines }));
  }
  const data = await geoGetTopTracks(country, 10);
  const arr: any[] = Array.isArray(data?.track) ? data.track : [];
  if (!arr.length) return sendInfo(ctx, `No data for country \`${country}\`.`);
  const lines = arr.map((t, i) => `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — *${t.artist?.name ?? '—'}* — \`${fmt(t.listeners)}\``);
  return message.reply(buildListPanel({ title: `Top tracks in ${country}`, lines }));
}
