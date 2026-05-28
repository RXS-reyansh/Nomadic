// soul/commands/lastfm/fmsimilar.ts
//
// Show artists similar to a given artist. Useful for discovery.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { safeLinkLabel } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, artistGetSimilar } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmsimilar',
  aliases: ['fmsim'] as string[],
  description: 'Show artists similar to a given artist (Last.fm).',
  usage: 'fmsimilar <artist>',
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
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);

  const artist = args.join(' ').trim();
  const data = await artistGetSimilar(artist, 15);
  const arr: any[] = Array.isArray(data?.artist) ? data.artist : data?.artist ? [data.artist] : [];
  if (!arr.length) return sendInfo(ctx, `No similar artists found for \`${artist}\`.`);

  const lines = arr.map((a, i) => {
    const match = a.match ? Math.round(parseFloat(a.match) * 100) : null;
    return `**${i + 1}.** [${safeLinkLabel(a.name)}](${a.url})${match != null ? ` — \`${match}% match\`` : ''}`;
  });
  return message.reply(
    buildListPanel({
      title: `Artists similar to ${artist}`,
      lines,
    }),
  );
}
