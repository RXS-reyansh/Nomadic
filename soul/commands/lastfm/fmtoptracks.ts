// soul/commands/lastfm/fmtoptracks.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  resolveTarget, parseLooseArgs, periodLabel, safeLinkLabel, fmt,
} from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetTopTracks } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmtoptracks',
  aliases: ['fmtopt', 'fmtt'] as string[],
  description: 'Show top tracks on Last.fm.',
  usage: `fmtoptracks
  fmtoptracks 3month
  fmtoptracks @user year 25`,
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
  const { userArg, period, limit } = parseLooseArgs(args);
  const cap = Math.min(Math.max(limit ?? 10, 1), 25);
  const p = period ?? 'overall';
  const target = await resolveTarget(client, message.guild, message.author, userArg);
  if (!target.lastfmUsername) {
    return sendInfo(
      ctx,
      target.isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.discordUser.username}** hasn't linked a Last.fm account.`,
    );
  }
  const data = await userGetTopTracks(target.lastfmUsername, p, cap);
  const arr: any[] = Array.isArray(data?.track) ? data.track : data?.track ? [data.track] : [];
  const lines = arr.map((t, i) => {
    const artist = t.artist?.name ?? 'Unknown';
    return `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — *${artist}* — \`${fmt(t.playcount)}\` plays`;
  });
  return message.reply(
    buildListPanel({
      title: `Top tracks — ${target.lastfmUsername}`,
      subHeader: `*${periodLabel(p)}*`,
      lines,
      emptyMessage: 'No top tracks in this period.',
      footer: `-# Period: \`${p}\` • Limit: \`${cap}\``,
    }),
  );
}
