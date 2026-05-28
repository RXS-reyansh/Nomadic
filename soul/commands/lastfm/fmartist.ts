// soul/commands/lastfm/fmartist.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { fmt } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, artistGetInfo } from '../../helpers/lastfmClient.js';
import { buildProfilePanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmartist',
  aliases: ['fmar', 'fma-info'] as string[],
  description: 'Look up info for an artist on Last.fm.',
  usage: 'fmartist <artist name>',
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
  const username = (await client.db.getLastfmUsername(message.author.id)) ?? undefined;
  const a = await artistGetInfo(artist, username);
  if (!a) return sendInfo(ctx, `Couldn't find an artist named \`${artist}\` on Last.fm.`);

  const fields: Array<[string, string]> = [
    ['Listeners', fmt(a.stats?.listeners)],
    ['Total plays', fmt(a.stats?.playcount)],
  ];
  if (username && a.stats?.userplaycount != null) {
    fields.push([`Your plays (${username})`, fmt(a.stats.userplaycount)]);
  }
  if (a.ontour === '1') fields.push(['Currently on tour', 'Yes']);

  const similar: string[] = (a.similar?.artist ?? []).slice(0, 5).map((s: any) => `[${s.name}](${s.url})`);
  const tags: string[] = (a.tags?.tag ?? []).slice(0, 5).map((tg: any) => `\`${tg.name}\``);
  const wiki = a.bio?.summary
    ? String(a.bio.summary).replace(/<a [^>]+>.*?<\/a>/gi, '').trim().slice(0, 500)
    : null;
  const bodyParts = [
    tags.length ? `**Tags:** ${tags.join(' ')}` : null,
    similar.length ? `**Similar:** ${similar.join(', ')}` : null,
    wiki,
  ].filter(Boolean);

  return message.reply(
    buildProfilePanel({
      title: a.name,
      fields,
      body: bodyParts.length ? bodyParts.join('\n\n') : undefined,
      imageUrl: (a.image ?? []).slice().reverse().find((i: any) => i?.['#text'])?.['#text'] || null,
      footer: `-# [Open on Last.fm](${a.url})`,
    }),
  );
}
