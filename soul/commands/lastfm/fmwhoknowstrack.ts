// soul/commands/lastfm/fmwhoknowstrack.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { fmt } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, trackGetInfo } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmwhoknowstrack',
  aliases: ['fmwkt'] as string[],
  description: 'Who in this server has scrobbled this track the most?',
  usage: 'fmwhoknowstrack <artist> - <track>',
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
  const title = joined.slice(idx + 3).trim();
  if (!artist || !title) return sendWrongUsage({ message, client }, options.name, options.usage);

  const all = await client.db.getAllLastfmLinks();
  await message.guild.members.fetch().catch((): null => null);
  const inGuild = [...all.entries()].filter(([uid]) => message.guild.members.cache.has(uid));
  if (!inGuild.length) return sendInfo(ctx, 'Nobody in this server has linked their Last.fm yet.');

  const rows = (
    await Promise.all(
      inGuild.map(async ([uid, fmName]) => {
        const t = await trackGetInfo(artist, title, fmName);
        const plays = t?.userplaycount ? parseInt(t.userplaycount, 10) : 0;
        return { uid, fmName, plays, name: t?.name ?? title, url: t?.url ?? null };
      }),
    )
  ).filter((r) => r.plays > 0);

  if (!rows.length) return sendInfo(ctx, `Nobody in this server has scrobbled **${title}** by **${artist}**.`);
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
      footer: `-# ${rows.length} of ${inGuild.length} linked members have scrobbled this track.`,
    }),
  );
}
