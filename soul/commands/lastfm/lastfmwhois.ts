// soul/commands/lastfm/lastfmwhois.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendInfo } from '../../components/statusMessages.js';
import { resolveUser } from '../../helpers/userResolver.js';

export const options = {
  name: 'lastfmwhois',
  aliases: ['fmwhois'] as string[],
  description: "Show which Last.fm account a Discord user has linked.",
  usage: `lastfmwhois
  lastfmwhois @user`,
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
  let target = message.author;
  if (args[0]) {
    const resolved = await resolveUser(client, message.guild, args[0]);
    if (resolved) target = resolved;
  }
  const username = await client.db.getLastfmUsername(target.id);
  const isSelf = target.id === message.author.id;
  if (!username) {
    return sendInfo(
      ctx,
      isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.username}** hasn't linked a Last.fm account.`,
    );
  }
  return sendInfo(
    ctx,
    isSelf
      ? `You're linked to Last.fm user **${username}** (https://www.last.fm/user/${encodeURIComponent(username)}).`
      : `**${target.username}** is linked to Last.fm user **${username}** (https://www.last.fm/user/${encodeURIComponent(username)}).`,
  );
}
