// soul/commands/lastfm/unlinklastfm.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendInfo, sendSuccess } from '../../components/statusMessages.js';

export const options = {
  name: 'unlinklastfm',
  aliases: [] as string[],
  description: 'Unlink your Last.fm account from your Discord account.',
  usage: 'unlinklastfm',
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const ctx = { message };
  const existing = await client.db.getLastfmLink(message.author.id);
  if (!existing) {
    return sendInfo(ctx, "You don't have a Last.fm account linked. Nothing to unlink.");
  }
  await client.db.unlinkLastfm(message.author.id);
  return sendSuccess(ctx, `Unlinked Last.fm user \`${existing.lastfm_username}\` from your Discord account.`);
}
