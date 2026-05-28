// soul/commands/spotify/linkspotify.ts
//
// Link a Spotify profile (ID or URL) to the invoker's Discord account.
// Validates the profile exists via the Spotify Web API before saving.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess, sendInfo } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import {
  isSpotifyConfigured,
  parseSpotifyUserId,
  getUserProfile,
  describeSpotifyFailure,
  isSpotifyFailure,
} from '../../helpers/spotifyClient.js';

export const options = {
  name: 'linkspotify',
  aliases: [] as string[],
  description: 'Link your Spotify profile to your Discord account.',
  usage: `linkspotify <spotify profile id>
  linkspotify <https://open.spotify.com/user/...>`,
  category: 'spotify',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);
  const ctx = { message };

  if (!isSpotifyConfigured()) {
    return sendError(ctx, 'Spotify integration is not configured on this bot. Please ask the developer.');
  }

  const spotifyId = parseSpotifyUserId(args.join(' '));
  if (!spotifyId) {
    return sendError(
      ctx,
      'That doesn\'t look like a valid Spotify profile ID or URL. Example: `31fskpqyqxwqfovpzjmusztm3bg4` or `https://open.spotify.com/user/31fskpqyqxwqfovpzjmusztm3bg4`.',
    );
  }

  const existing = await client.db.getSpotifyLink(message.author.id);
  if (existing) {
    if (existing.spotify_id === spotifyId) {
      return sendInfo(
        ctx,
        `Already linked to that Spotify account (\`${existing.spotify_id}\`). Use \`unlinkspotify\` first if you want to switch.`,
      );
    }
    return sendInfo(
      ctx,
      `You're already linked to \`${existing.spotify_id}\`. Use \`unlinkspotify\` first if you want to switch to a different account.`,
    );
  }

  const result = await getUserProfile(spotifyId);
  if (isSpotifyFailure(result)) {
    if (result.kind === 'notFound') {
      return sendError(
        ctx,
        `Couldn't find a Spotify profile with ID \`${spotifyId}\`. Double-check the ID or URL and try again.`,
      );
    }
    return sendError(ctx, describeSpotifyFailure(result));
  }

  const profile = result.data;
  await client.db.linkSpotify(message.author.id, profile.id, profile.display_name);
  return sendSuccess(
    ctx,
    `Linked your Discord account to Spotify profile **${profile.display_name ?? profile.id}** (\`${profile.id}\`).`,
  );
}
