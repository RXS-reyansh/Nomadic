// soul/commands/lastfm/fmcommon.ts
//
// Like fmtaste but compares to *every linked user in the guild* and shows the
// artists most listened to by everyone.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  parseLooseArgs, periodLabel, safeLinkLabel, fmt,
} from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetTopArtists } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmcommon',
  aliases: ['fmserverartists'] as string[],
  description: 'Show artists most commonly listened to by linked Last.fm users in this server.',
  usage: 'fmcommon [period]',
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 15,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!message.guild) return sendError(ctx, 'This command only works inside a server.');
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');

  const { period } = parseLooseArgs(args);
  const p = period ?? 'overall';

  const all = await client.db.getAllLastfmLinks();
  await message.guild.members.fetch().catch((): null => null);
  const inGuild = [...all.entries()].filter(([uid]) => message.guild.members.cache.has(uid));
  if (inGuild.length < 2) {
    return sendInfo(ctx, 'Need at least 2 linked users in this server to find common ground.');
  }

  const tally = new Map<string, { name: string; url: string; users: Set<string>; plays: number }>();
  await Promise.all(
    inGuild.map(async ([uid, fmName]) => {
      const data = await userGetTopArtists(fmName, p, 25);
      const arr: any[] = Array.isArray(data?.artist) ? data.artist : [];
      for (const a of arr) {
        const key = a.name.toLowerCase();
        const cur = tally.get(key) ?? { name: a.name, url: a.url, users: new Set<string>(), plays: 0 };
        cur.users.add(uid);
        cur.plays += parseInt(a.playcount ?? '0', 10);
        tally.set(key, cur);
      }
    }),
  );

  const ranked = [...tally.values()]
    .filter((x) => x.users.size >= 2)
    .sort((a, b) => b.users.size - a.users.size || b.plays - a.plays);
  if (!ranked.length) {
    return sendInfo(ctx, 'No artists are listened to by 2+ linked members in this server.');
  }
  const lines = ranked
    .slice(0, 15)
    .map((r, i) => `**${i + 1}.** [${safeLinkLabel(r.name)}](${r.url}) — \`${r.users.size}\` people, \`${fmt(r.plays)}\` total plays`);

  return message.reply(
    buildListPanel({
      title: `Server's common artists`,
      subHeader: `*${periodLabel(p)}* — checked **${inGuild.length}** linked members`,
      lines,
    }),
  );
}
