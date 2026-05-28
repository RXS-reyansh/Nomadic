// soul/commands/lastfm/fmwhoknowsalbum.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { fmt } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, albumGetInfo } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmwhoknowsalbum',
  aliases: ['fmwka'] as string[],
  description: 'Who in this server has scrobbled this album the most?',
  usage: 'fmwhoknowsalbum <artist> - <album>',
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
  const joined = args.join(' ');
  const idx = joined.indexOf(' - ');
  if (idx < 0) return sendWrongUsage({ message, client }, options.name, options.usage);
  const artist = joined.slice(0, idx).trim();
  const album = joined.slice(idx + 3).trim();
  if (!artist || !album) return sendWrongUsage({ message, client }, options.name, options.usage);

  const all = await client.db.getAllLastfmLinks();
  await message.guild.members.fetch().catch((): null => null);
  const inGuild = [...all.entries()].filter(([uid]) => message.guild.members.cache.has(uid));
  if (!inGuild.length) return sendInfo(ctx, 'Nobody in this server has linked their Last.fm yet.');

  const rows = (
    await Promise.all(
      inGuild.map(async ([uid, fmName]) => {
        const a = await albumGetInfo(artist, album, fmName);
        const plays = a?.userplaycount ? parseInt(a.userplaycount, 10) : 0;
        return { uid, fmName, plays, name: a?.name ?? album, url: a?.url ?? null };
      }),
    )
  ).filter((r) => r.plays > 0);

  if (!rows.length) return sendInfo(ctx, `Nobody in this server has scrobbled **${album}** by **${artist}**.`);
  rows.sort((a, b) => b.plays - a.plays);

  const top = rows[0];
  const lines = rows.slice(0, 25).map((r, i) => {
    const member = message.guild.members.cache.get(r.uid);
    const name = member?.displayName ?? r.fmName;
    const crown = i === 0 ? '👑 ' : '';
    return `**${i + 1}.** ${crown}${name} (\`${r.fmName}\`) — \`${fmt(r.plays)}\` plays`;
  });

  return message.reply(
    buildListPanel({
      title: `Who knows ${top.name}?`,
      subHeader: top.url ? `Top scrobblers of [${top.name}](${top.url}) by **${artist}**.` : undefined,
      lines,
      footer: `-# ${rows.length} of ${inGuild.length} linked members have scrobbled this album.`,
    }),
  );
}
