// soul/commands/lastfm/fmloved.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  resolveTarget, parseLooseArgs, safeLinkLabel, uts,
} from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetLovedTracks } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmloved',
  aliases: ['fmlovedtracks'] as string[],
  description: "Show a user's loved tracks on Last.fm.",
  usage: `fmloved
  fmloved @user 25`,
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
  const { userArg, limit } = parseLooseArgs(args);
  const cap = Math.min(Math.max(limit ?? 10, 1), 25);
  const target = await resolveTarget(client, message.guild, message.author, userArg);
  if (!target.lastfmUsername) {
    return sendInfo(
      ctx,
      target.isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.discordUser.username}** hasn't linked a Last.fm account.`,
    );
  }
  const data = await userGetLovedTracks(target.lastfmUsername, cap);
  const arr: any[] = Array.isArray(data?.track) ? data.track : data?.track ? [data.track] : [];
  const lines = arr.map((t, i) => {
    const artist = t.artist?.name ?? 'Unknown';
    const when = t.date?.uts ? ` ${uts(t.date.uts)}` : '';
    return `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — *${artist}*${when}`;
  });
  return message.reply(
    buildListPanel({
      title: `Loved tracks — ${target.lastfmUsername}`,
      lines,
      emptyMessage: "No loved tracks yet.",
      footer: `-# Total: ${data?.['@attr']?.total ?? '?'}`,
    }),
  );
}
