// soul/commands/lastfm/fmrecent.ts
//
// List the most recent scrobbles. Default 10, max 25.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import { resolveTarget, parseLooseArgs, uts, safeLinkLabel } from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetRecentTracks } from '../../helpers/lastfmClient.js';
import { buildListPanel } from '../../components/lastfm.js';

export const options = {
  name: 'fmrecent',
  aliases: ['fmlast', 'fmhistory'] as string[],
  description: 'Show recent scrobbles from Last.fm.',
  usage: `fmrecent
  fmrecent @user
  fmrecent 25
  fmrecent @user 15`,
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
  if (!isLastfmConfigured()) {
    return sendError(ctx, 'Last.fm integration is not configured on this bot. Please ask the developer.');
  }

  const { userArg, limit } = parseLooseArgs(args);
  const cap = Math.min(Math.max(limit ?? 10, 1), 25);
  const target = await resolveTarget(client, message.guild, message.author, userArg);
  if (!target.lastfmUsername) {
    return sendInfo(
      ctx,
      target.isSelf
        ? `You haven't linked a Last.fm account. Use \`${client.config.prefix}linklastfm <username>\`.`
        : `**${target.discordUser.username}** hasn't linked a Last.fm account.`,
    );
  }

  const data = await userGetRecentTracks(target.lastfmUsername, cap);
  const tracks: any[] = Array.isArray(data?.track) ? data.track : data?.track ? [data.track] : [];
  if (!tracks.length) {
    return sendInfo(ctx, `**${target.lastfmUsername}** hasn't scrobbled anything yet.`);
  }

  const lines = tracks.slice(0, cap).map((t, i) => {
    const live = t['@attr']?.nowplaying === 'true';
    const artist =
      typeof t.artist === 'string' ? t.artist : t.artist?.['#text'] ?? t.artist?.name ?? 'Unknown';
    const when = live ? '`now playing`' : t.date?.uts ? uts(t.date.uts) : '';
    return `**${i + 1}.** [${safeLinkLabel(t.name)}](${t.url}) — *${artist}* ${when}`;
  });

  return message.reply(
    buildListPanel({
      title: `Recent scrobbles for ${target.lastfmUsername}`,
      lines,
      footer: `-# Showing ${tracks.length} of ${data?.['@attr']?.total ?? '?'} total scrobbles.`,
    }),
  );
}
