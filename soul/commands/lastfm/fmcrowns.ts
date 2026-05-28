// soul/commands/lastfm/fmcrowns.ts
//
// "Crown count" — how many top-scrobbler crowns each linked member holds for
// the artists in their own top-25. We probe each member's top artists, then
// for each artist check who in the guild has the highest playcount, then
// tally crowns.
//
// This is O(M × N) Last.fm calls where M = linked members and N ≈ 25 artists
// each, so we cap to the top 10 members + top 10 artists per member to stay
// within reasonable rate limits.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  parseLooseArgs, periodLabel,
} from '../../helpers/lastfmHelpers.js';
import {
  isLastfmConfigured,
  userGetTopArtists,
  artistGetInfo,
} from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmcrowns',
  aliases: ['fmcrown'] as string[],
  description: 'Show who holds top-scrobbler crowns across this server.',
  usage: 'fmcrowns [period]',
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 30,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!message.guild) return sendError(ctx, 'This command only works inside a server.');
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');
  const { period } = parseLooseArgs(args);
  const p = period ?? 'overall';

  const all = await client.db.getAllLastfmLinks();
  await message.guild.members.fetch().catch((): null => null);
  const inGuild = [...all.entries()].filter(([uid]) => message.guild.members.cache.has(uid)).slice(0, 10);
  if (inGuild.length < 2) {
    return sendInfo(ctx, 'Need at least 2 linked users in this server to assign crowns.');
  }

  // 1. Gather candidate artists from each member's top 10.
  const candidateArtists = new Set<string>();
  await Promise.all(
    inGuild.map(async ([, fmName]) => {
      const data = await userGetTopArtists(fmName, p, 10);
      const arr: any[] = Array.isArray(data?.artist) ? data.artist : [];
      for (const a of arr) candidateArtists.add(a.name);
    }),
  );
  if (!candidateArtists.size) {
    return sendInfo(ctx, 'Not enough scrobble data to determine crowns.');
  }

  // 2. For each candidate artist, ask Last.fm per member for their playcount.
  const crowns = new Map<string, number>(); // discord uid → crown count
  for (const uid of inGuild.map(([u]) => u)) crowns.set(uid, 0);

  await Promise.all(
    [...candidateArtists].map(async (artist) => {
      let bestUid: string | null = null;
      let bestPlays = 0;
      const counts = await Promise.all(
        inGuild.map(async ([uid, fmName]) => {
          const a = await artistGetInfo(artist, fmName);
          const plays = a?.stats?.userplaycount ? parseInt(a.stats.userplaycount, 10) : 0;
          return { uid, plays };
        }),
      );
      for (const c of counts) {
        if (c.plays > bestPlays) {
          bestPlays = c.plays;
          bestUid = c.uid;
        }
      }
      // Require minimum 5 plays to count as a crown so noise doesn't flood the
      // leaderboard.
      if (bestUid && bestPlays >= 5) {
        crowns.set(bestUid, (crowns.get(bestUid) ?? 0) + 1);
      }
    }),
  );

  const ranked = [...crowns.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    return sendInfo(ctx, 'Nobody has earned a crown yet.');
  }
  const lines = ranked.slice(0, 25).map(([uid, n], i) => {
    const member = message.guild.members.cache.get(uid);
    const name = member?.displayName ?? `<@${uid}>`;
    return `**${i + 1}.** ${name} — 👑 ${n}`;
  });

  return message.reply(
    buildListPanel({
      title: `Crown holders — ${message.guild.name}`,
      subHeader: `*${periodLabel(p)}* — sampled top 10 linked members × top 10 artists each`,
      lines,
    }),
  );
}
