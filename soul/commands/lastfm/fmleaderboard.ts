// soul/commands/lastfm/fmleaderboard.ts
//
// Server scrobble leaderboard — total Last.fm playcount per linked member.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { fmt } from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetInfo } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmleaderboard',
  aliases: ['fmlb', 'fmtop'] as string[],
  description: 'Server-wide scrobble leaderboard for linked Last.fm users.',
  usage: 'fmleaderboard',
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 15,
};

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!message.guild) return sendError(ctx, 'This command only works inside a server.');
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');

  const all = await client.db.getAllLastfmLinks();
  await message.guild.members.fetch().catch((): null => null);
  const inGuild = [...all.entries()].filter(([uid]) => message.guild.members.cache.has(uid));
  if (!inGuild.length) return sendInfo(ctx, 'Nobody in this server has linked their Last.fm yet.');

  const rows = await Promise.all(
    inGuild.map(async ([uid, fmName]) => {
      const info = await userGetInfo(fmName);
      return {
        uid,
        fmName,
        plays: info?.playcount ? parseInt(info.playcount, 10) : 0,
      };
    }),
  );
  rows.sort((a, b) => b.plays - a.plays);

  const lines = rows.slice(0, 25).map((r, i) => {
    const member = message.guild.members.cache.get(r.uid);
    const name = member?.displayName ?? r.fmName;
    const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '';
    return `**${i + 1}.** ${medal}${name} (\`${r.fmName}\`) — \`${fmt(r.plays)}\` total scrobbles`;
  });

  return message.reply(
    buildListPanel({
      title: `Scrobble leaderboard — ${message.guild.name}`,
      lines,
      footer: `-# ${inGuild.length} linked member${inGuild.length === 1 ? '' : 's'}.`,
    }),
  );
}
