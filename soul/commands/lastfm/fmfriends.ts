// soul/commands/lastfm/fmfriends.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  resolveTarget, parseLooseArgs, fmt,
} from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetFriends } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmfriends',
  aliases: [] as string[],
  description: "List a user's Last.fm friends.",
  usage: `fmfriends
  fmfriends @user 25`,
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
  const cap = Math.min(Math.max(limit ?? 15, 1), 50);
  const target = await resolveTarget(client, message.guild, message.author, userArg);
  if (!target.lastfmUsername) {
    return sendInfo(
      ctx,
      target.isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.discordUser.username}** hasn't linked a Last.fm account.`,
    );
  }
  const data = await userGetFriends(target.lastfmUsername, cap);
  const arr: any[] = Array.isArray(data?.user) ? data.user : data?.user ? [data.user] : [];
  if (!arr.length) {
    return sendInfo(ctx, `**${target.lastfmUsername}** has no Last.fm friends listed.`);
  }
  const lines = arr.map((u, i) => `**${i + 1}.** [${u.name}](${u.url}) — \`${fmt(u.playcount)}\` plays`);
  return message.reply(
    buildListPanel({
      title: `Friends — ${target.lastfmUsername}`,
      lines,
      footer: `-# Total: ${data?.['@attr']?.total ?? arr.length}`,
    }),
  );
}
