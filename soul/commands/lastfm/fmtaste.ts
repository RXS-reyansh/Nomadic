// soul/commands/lastfm/fmtaste.ts
//
// Compare two users' top artists and surface the overlap.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  resolveTarget, parseLooseArgs, periodLabel, safeLinkLabel,
} from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, userGetTopArtists } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmtaste',
  aliases: ['fmcompare'] as string[],
  description: "Compare two users' Last.fm taste — overlap of their top artists.",
  usage: 'fmtaste <@user> [period]',
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');
  const { userArg, period } = parseLooseArgs(args);
  if (!userArg) return sendWrongUsage({ message, client }, options.name, options.usage);
  const p = period ?? 'overall';

  const me = await client.db.getLastfmUsername(message.author.id);
  if (!me) return sendInfo(ctx, `You haven't linked Last.fm. Use \`${client.config.prefix}linklastfm <username>\` first.`);

  const them = await resolveTarget(client, message.guild, message.author, userArg);
  if (them.discordUser.id === message.author.id) return sendError(ctx, "Pick someone other than yourself.");
  if (!them.lastfmUsername) return sendInfo(ctx, `**${them.discordUser.username}** hasn't linked a Last.fm account.`);

  const [a, b] = await Promise.all([
    userGetTopArtists(me, p, 100),
    userGetTopArtists(them.lastfmUsername, p, 100),
  ]);
  const aArr: any[] = Array.isArray(a?.artist) ? a.artist : [];
  const bArr: any[] = Array.isArray(b?.artist) ? b.artist : [];
  if (!aArr.length || !bArr.length) {
    return sendInfo(ctx, 'Not enough data to compare.');
  }

  const bMap = new Map<string, any>();
  for (const x of bArr) bMap.set(x.name.toLowerCase(), x);
  const overlap = aArr
    .map((x) => {
      const match = bMap.get(x.name.toLowerCase());
      if (!match) return null;
      const total = parseInt(x.playcount ?? '0', 10) + parseInt(match.playcount ?? '0', 10);
      return { name: x.name, url: x.url, mePlays: x.playcount, themPlays: match.playcount, total };
    })
    .filter(Boolean) as Array<{ name: string; url: string; mePlays: string; themPlays: string; total: number }>;
  overlap.sort((x, y) => y.total - x.total);

  if (!overlap.length) {
    return sendInfo(ctx, `Looks like you and **${them.lastfmUsername}** have *zero* artists in common in this period.`);
  }

  const lines = overlap.slice(0, 15).map(
    (o, i) =>
      `**${i + 1}.** [${safeLinkLabel(o.name)}](${o.url}) — \`${o.mePlays}\` vs \`${o.themPlays}\``,
  );

  return message.reply(
    buildListPanel({
      title: `Taste compare: ${me} vs ${them.lastfmUsername}`,
      subHeader: `*${periodLabel(p)}* — **${overlap.length}** artists in common`,
      lines,
    }),
  );
}
