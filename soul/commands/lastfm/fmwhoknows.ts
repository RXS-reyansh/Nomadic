// soul/commands/lastfm/fmwhoknows.ts
//
// "Who in this server knows <artist>?" — for every linked guild member, fetch
// their playcount for the given artist via artist.getInfo(username=...).

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { fmt } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, artistGetInfo } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmwhoknows',
  aliases: ['fmwk'] as string[],
  description: 'Who in this server has scrobbled this artist the most?',
  usage: 'fmwhoknows <artist>',
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
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);
  const artist = args.join(' ').trim();

  const all = await client.db.getAllLastfmLinks();
  await message.guild.members.fetch().catch((): null => null);
  const inGuild = [...all.entries()].filter(([uid]) => message.guild.members.cache.has(uid));
  if (!inGuild.length) {
    return sendInfo(ctx, 'Nobody in this server has linked their Last.fm yet.');
  }

  const rows = (
    await Promise.all(
      inGuild.map(async ([uid, fmName]) => {
        const a = await artistGetInfo(artist, fmName);
        const plays = a?.stats?.userplaycount ? parseInt(a.stats.userplaycount, 10) : 0;
        return { uid, fmName, plays, displayUrl: a?.url ?? null, displayName: a?.name ?? artist };
      }),
    )
  ).filter((r) => r.plays > 0);

  if (!rows.length) {
    return sendInfo(ctx, `Nobody in this server has scrobbled **${artist}**.`);
  }
  rows.sort((a, b) => b.plays - a.plays);

  const lines = rows.slice(0, 25).map((r, i) => {
    const member = message.guild.members.cache.get(r.uid);
    const name = member?.displayName ?? r.fmName;
    const crown = i === 0 ? '👑 ' : '';
    return `**${i + 1}.** ${crown}${name} (\`${r.fmName}\`) — \`${fmt(r.plays)}\` plays`;
  });

  const top = rows[0];
  const subHeader = top.displayUrl
    ? `Top scrobbler of [${top.displayName}](${top.displayUrl}) in this server.`
    : `Top scrobbler of **${artist}** in this server.`;

  return message.reply(
    buildListPanel({
      title: `Who knows ${top.displayName}?`,
      subHeader,
      lines,
      footer: `-# ${rows.length} of ${inGuild.length} linked members have scrobbled this artist.`,
    }),
  );
}
