// soul/commands/lastfm/fmrecommend.ts
//
// Pull the user's top 5 artists, fetch a few similar artists for each, then
// surface a deduped recommendation list with the top track for each suggestion.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  resolveTarget, parseLooseArgs, periodLabel, safeLinkLabel,
} from '../../helpers/lastfmHelpers.js';
import {
  isLastfmConfigured,
  userGetTopArtists,
  artistGetSimilar,
  artistGetTopTracks,
} from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmrecommend',
  aliases: ['fmrecs', 'fmsuggest'] as string[],
  description: 'Recommend new artists & tracks based on your Last.fm history.',
  usage: `fmrecommend
  fmrecommend @user
  fmrecommend month`,
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 10,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');
  const { userArg, period } = parseLooseArgs(args);
  const p = period ?? '3month';
  const target = await resolveTarget(client, message.guild, message.author, userArg);
  if (!target.lastfmUsername) {
    return sendInfo(
      ctx,
      target.isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.discordUser.username}** hasn't linked a Last.fm account.`,
    );
  }

  const tops = await userGetTopArtists(target.lastfmUsername, p, 5);
  const seedArtists: any[] = Array.isArray(tops?.artist) ? tops.artist : tops?.artist ? [tops.artist] : [];
  if (!seedArtists.length) return sendInfo(ctx, "Not enough scrobble data to recommend anything.");

  // Build "already heard" set so we don't recommend stuff the user already listens to.
  const heard = new Set(seedArtists.map((a) => a.name.toLowerCase()));

  const recs = new Map<string, { name: string; url: string; score: number }>();
  await Promise.all(
    seedArtists.map(async (seed) => {
      const sim = await artistGetSimilar(seed.name, 10);
      const arr: any[] = Array.isArray(sim?.artist) ? sim.artist : [];
      for (const a of arr) {
        const key = a.name.toLowerCase();
        if (heard.has(key)) continue;
        const score = parseFloat(a.match ?? '0');
        const cur = recs.get(key);
        if (!cur || cur.score < score) {
          recs.set(key, { name: a.name, url: a.url, score });
        }
      }
    }),
  );

  const ranked = [...recs.values()].sort((a, b) => b.score - a.score).slice(0, 8);
  if (!ranked.length) return sendInfo(ctx, 'No fresh recommendations could be derived.');

  // Grab the top track for each rec so the output is immediately listenable.
  const enriched = await Promise.all(
    ranked.map(async (r) => {
      const top = await artistGetTopTracks(r.name, 1);
      const t = (Array.isArray(top?.track) ? top.track[0] : top?.track) as any;
      return { ...r, topTrack: t };
    }),
  );

  const lines = enriched.map((r, i) => {
    const trackPart = r.topTrack
      ? ` — try [${safeLinkLabel(r.topTrack.name)}](${r.topTrack.url})`
      : '';
    return `**${i + 1}.** [${safeLinkLabel(r.name)}](${r.url}) (\`${Math.round(r.score * 100)}% match\`)${trackPart}`;
  });

  return message.reply(
    buildListPanel({
      title: `Recommendations for ${target.lastfmUsername}`,
      subHeader: `*Based on your top artists — ${periodLabel(p)}*`,
      lines,
      footer: `-# Use \`${client.config.prefix}fmplay <artist> - <track>\` to play any of these.`,
    }),
  );
}
