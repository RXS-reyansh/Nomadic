// soul/commands/lastfm/fmalbum.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { fmt, safeLinkLabel } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, albumGetInfo } from '../../helpers/lastfmClient.js';
import { buildProfilePanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmalbum',
  aliases: ['fmal-info'] as string[],
  description: 'Look up info for an album on Last.fm.',
  usage: 'fmalbum <artist> - <album>',
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
  const joined = args.join(' ');
  const idx = joined.indexOf(' - ');
  if (idx < 0) return sendWrongUsage({ message, client }, options.name, options.usage);
  const artist = joined.slice(0, idx).trim();
  const album = joined.slice(idx + 3).trim();
  if (!artist || !album) return sendWrongUsage({ message, client }, options.name, options.usage);

  const username = (await client.db.getLastfmUsername(message.author.id)) ?? undefined;
  const a = await albumGetInfo(artist, album, username);
  if (!a) return sendInfo(ctx, `Couldn't find that album on Last.fm. Make sure it's spelled \`Artist - Album\`.`);

  const fields: Array<[string, string]> = [
    ['Artist', `[${a.artist}](https://www.last.fm/music/${encodeURIComponent(a.artist)})`],
    ['Listeners', fmt(a.listeners)],
    ['Total plays', fmt(a.playcount)],
  ];
  if (username && a.userplaycount != null) {
    fields.push([`Your plays (${username})`, fmt(a.userplaycount)]);
  }

  const tracks: any[] = a.tracks?.track ?? [];
  const tracklist = tracks.slice(0, 10).map(
    (t: any, i: number) => `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url})`,
  );
  const tags: string[] = (a.tags?.tag ?? []).slice(0, 5).map((tg: any) => `\`${tg.name}\``);
  const wiki = a.wiki?.summary
    ? String(a.wiki.summary).replace(/<a [^>]+>.*?<\/a>/gi, '').trim().slice(0, 400)
    : null;
  const bodyParts = [
    tracklist.length ? `**Tracks**\n${tracklist.join('\n')}` : null,
    tags.length ? `**Tags:** ${tags.join(' ')}` : null,
    wiki,
  ].filter(Boolean);

  return message.reply(
    buildProfilePanel({
      title: `${a.name} — ${a.artist}`,
      fields,
      body: bodyParts.length ? bodyParts.join('\n\n') : undefined,
      imageUrl: (a.image ?? []).slice().reverse().find((i: any) => i?.['#text'])?.['#text'] || null,
      footer: `-# [Open on Last.fm](${a.url})`,
    }),
  );
}
