// soul/commands/lastfm/fmprofile.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { resolveTarget, parseLooseArgs, fmt } from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetInfo } from '../../helpers/lastfmClient.js';
import { buildProfilePanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmprofile',
  aliases: ['fminfo', 'lastfmprofile'] as string[],
  description: "Show a Last.fm profile summary.",
  usage: `fmprofile
  fmprofile @user`,
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

  const { userArg } = parseLooseArgs(args);
  const target = await resolveTarget(client, message.guild, message.author, userArg);
  if (!target.lastfmUsername) {
    return sendInfo(
      ctx,
      target.isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.discordUser.username}** hasn't linked a Last.fm account.`,
    );
  }
  const info = await userGetInfo(target.lastfmUsername);
  if (!info) return sendError(ctx, `Couldn't load Last.fm profile for \`${target.lastfmUsername}\`.`);

  const image = (info.image ?? []).slice().reverse().find((i: any) => i?.['#text'])?.['#text'] || null;
  const fields: Array<[string, string]> = [
    ['Total scrobbles', fmt(info.playcount)],
    ['Tracks scrobbled', fmt(info.track_count)],
    ['Albums scrobbled', fmt(info.album_count)],
    ['Artists scrobbled', fmt(info.artist_count)],
    ['Country', info.country && info.country !== 'None' ? info.country : '—'],
    ['Subscriber', info.subscriber === '1' ? 'Yes' : 'No'],
  ];
  if (info.registered?.unixtime) {
    fields.push(['Registered', `<t:${info.registered.unixtime}:D>`]);
  }

  return message.reply(
    buildProfilePanel({
      title: info.realname?.trim() ? `${info.realname} (${info.name})` : info.name,
      fields,
      imageUrl: image,
      footer: `-# [Open profile](${info.url})`,
    }),
  );
}
