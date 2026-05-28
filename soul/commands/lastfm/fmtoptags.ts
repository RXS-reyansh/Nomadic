// soul/commands/lastfm/fmtoptags.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  resolveTarget, parseLooseArgs, safeLinkLabel, fmt,
} from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetTopTags } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmtoptags',
  aliases: ['fmtags'] as string[],
  description: "Show a user's top tags on Last.fm (genres they've assigned).",
  usage: `fmtoptags
  fmtoptags @user 25`,
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
  const cap = Math.min(Math.max(limit ?? 10, 1), 50);
  const target = await resolveTarget(client, message.guild, message.author, userArg);
  if (!target.lastfmUsername) {
    return sendInfo(
      ctx,
      target.isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.discordUser.username}** hasn't linked a Last.fm account.`,
    );
  }
  const data = await userGetTopTags(target.lastfmUsername, cap);
  const arr: any[] = Array.isArray(data?.tag) ? data.tag : data?.tag ? [data.tag] : [];
  const lines = arr.map((t, i) => `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — \`${fmt(t.count)}\` uses`);
  return message.reply(
    buildListPanel({
      title: `Top tags — ${target.lastfmUsername}`,
      lines,
      emptyMessage: "This user hasn't assigned any tags.",
    }),
  );
}
