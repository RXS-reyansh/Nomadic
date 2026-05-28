// soul/commands/lastfm/linklastfm.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess, sendInfo } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, userExists } from '../../helpers/lastfmClient.js';

export const options = {
  name: 'linklastfm',
  aliases: [] as string[],
  description: 'Link your Last.fm account to your Discord account.',
  usage: 'linklastfm <last.fm username>',
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

const URL_RE = /^(?:https?:\/\/)?(?:www\.)?last\.fm\/user\/([A-Za-z0-9_-]+)/i;

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);
  const ctx = { message };
  if (!isLastfmConfigured()) {
    return sendError(ctx, 'Last.fm integration is not configured on this bot. Please ask the developer.');
  }

  let username = args[0].trim();
  const m = username.match(URL_RE);
  if (m) username = m[1];
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) {
    return sendError(ctx, 'That doesn\'t look like a valid Last.fm username. Use 2-30 characters: letters, numbers, `_`, `-`.');
  }

  const existing = await client.db.getLastfmLink(message.author.id);
  if (existing) {
    if (existing.lastfm_username.toLowerCase() === username.toLowerCase()) {
      return sendInfo(
        ctx,
        `Already linked to that Last.fm account (\`${existing.lastfm_username}\`). Use \`unlinklastfm\` first if you want to switch.`,
      );
    }
    return sendInfo(
      ctx,
      `You're already linked to \`${existing.lastfm_username}\`. Use \`unlinklastfm\` first if you want to switch.`,
    );
  }

  const ok = await userExists(username);
  if (!ok) {
    return sendError(ctx, `No Last.fm user named \`${username}\` exists. Double-check the username and try again.`);
  }

  await client.db.linkLastfm(message.author.id, username);
  return sendSuccess(ctx, `Linked your Discord account to Last.fm user **${username}**.`);
}
