// soul/commands/lastfm/fmtrack.ts
//
// Look up info for a track. Format: `<artist> - <title>`. If the user has
// linked Last.fm, we also include their per-track playcount.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { fmt } from '../../helpers/lastfmHelpers.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { isLastfmConfigured, trackGetInfo } from '../../helpers/lastfmClient.js';
import { buildProfilePanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmtrack',
  aliases: ['fmt-info'] as string[],
  description: 'Look up info for a track on Last.fm.',
  usage: 'fmtrack <artist> - <track title>',
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

export function splitArtistTitle(input: string): { artist: string; title: string } | null {
  const idx = input.indexOf(' - ');
  if (idx < 0) return null;
  const artist = input.slice(0, idx).trim();
  const title = input.slice(idx + 3).trim();
  if (!artist || !title) return null;
  return { artist, title };
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');
  const joined = args.join(' ').trim();
  const parsed = splitArtistTitle(joined);
  if (!parsed) return sendWrongUsage({ message, client }, options.name, options.usage);

  const username = (await client.db.getLastfmUsername(message.author.id)) ?? undefined;
  const t = await trackGetInfo(parsed.artist, parsed.title, username);
  if (!t) return sendInfo(ctx, `Couldn't find that track on Last.fm. Make sure it's spelled \`Artist - Title\`.`);

  const fields: Array<[string, string]> = [
    ['Artist', `[${t.artist?.name ?? '—'}](${t.artist?.url ?? 'https://last.fm'})`],
    ['Listeners', fmt(t.listeners)],
    ['Total plays', fmt(t.playcount)],
    ['Duration', t.duration ? `${Math.floor(parseInt(t.duration, 10) / 60000)}:${String(Math.floor((parseInt(t.duration, 10) / 1000) % 60)).padStart(2, '0')}` : '—'],
  ];
  if (username && t.userplaycount != null) {
    fields.push([`Your plays (${username})`, fmt(t.userplaycount)]);
  }
  if (t.album?.title) {
    fields.push(['Album', `[${t.album.title}](${t.album.url})`]);
  }

  const tags: string[] = (t.toptags?.tag ?? []).slice(0, 5).map((tg: any) => `\`${tg.name}\``);
  const wiki = t.wiki?.summary
    ? String(t.wiki.summary).replace(/<a [^>]+>.*?<\/a>/gi, '').trim().slice(0, 500)
    : null;

  return message.reply(
    buildProfilePanel({
      title: `${t.name} — ${t.artist?.name ?? '—'}`,
      fields,
      body: [tags.length ? `**Tags:** ${tags.join(' ')}` : null, wiki].filter(Boolean).join('\n\n') || undefined,
      imageUrl: (t.album?.image ?? []).slice().reverse().find((i: any) => i?.['#text'])?.['#text'] || null,
      footer: `-# [Open on Last.fm](${t.url})`,
    }),
  );
}
