// soul/commands/spotify/unlinkspotify.ts
//
// Removes the invoker's Spotify link from the database.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendInfo, sendSuccess } from '../../components/statusMessages.js';

export const options = {
  name: 'unlinkspotify',
  aliases: [] as string[],
  description: 'Unlink your Spotify profile from your Discord account.',
  usage: 'unlinkspotify',
  category: 'spotify',
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
  const existing = await client.db.getSpotifyLink(message.author.id);
  if (!existing) {
    return sendInfo(ctx, "You don't have a Spotify account linked. Nothing to unlink.");
  }
  await client.db.unlinkSpotify(message.author.id);
  return sendSuccess(ctx, `Unlinked Spotify profile \`${existing.spotify_id}\` from your Discord account.`);
}
