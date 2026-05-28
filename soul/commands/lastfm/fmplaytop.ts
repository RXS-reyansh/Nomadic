// soul/commands/lastfm/fmplaytop.ts
//
// Play the user's #1 top track for a given period (default: last 7 days).
// Mirrors play.ts wiring exactly so the queue/player flow is identical.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  sendLoadingMessage,
  sendTrackAddedMessage,
  sendPlaylistAddedMessage,
} from '../../components/addedToQueue.js';
import { extractThumbnail, formatDuration } from '../../utils/formatting.js';
import { unifiedSearch } from '../../helpers/sourceSearch.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';
import { addTracks } from '../../helpers/sessionQueue.js';
import {
  parseLooseArgs, periodLabel,
} from '../../helpers/lastfmHelpers.js';
import { isLastfmConfigured, userGetTopTracks } from '../../helpers/lastfmClient.js';

export const options = {
  name: 'fmplaytop',
  aliases: ['fmpt', 'fmptop'] as string[],
  description: "Play your #1 top track on Last.fm for the chosen period.",
  usage: `fmplaytop
  fmplaytop month
  fmplaytop year`,
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  cooldown: 5,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return sendError(ctx, 'You must be in a voice channel.');

  const username = await client.db.getLastfmUsername(message.author.id);
  if (!username) {
    return sendInfo(ctx, `You haven't linked Last.fm. Use \`${client.config.prefix}linklastfm <username>\` first.`);
  }
  const { period } = parseLooseArgs(args);
  const p = period ?? '7day';
  const data = await userGetTopTracks(username, p, 1);
  const arr: any[] = Array.isArray(data?.track) ? data.track : data?.track ? [data.track] : [];
  if (!arr.length) return sendInfo(ctx, `No top tracks for ${periodLabel(p)}.`);
  const t = arr[0];
  const artistName = t.artist?.name ?? '';
  if (!artistName || !t.name) return sendError(ctx, "Couldn't read track info from Last.fm.");
  const query = `${artistName} - ${t.name}`;

  const loadingMsg = await sendLoadingMessage(ctx, query);
  let result: any;
  try {
    result = await unifiedSearch(client, query, message.author);
  } catch {
    return sendError(ctx, 'Failed to search for that track.');
  }
  if (!result?.tracks?.length) return sendError(ctx, 'No results found.');

  const player = await client.kazagumo.createPlayer({
    guildId: message.guild.id,
    voiceId: voiceChannel.id,
    textId: message.channel.id,
    deaf: true,
    volume: 100,
  });
  player.textId = message.channel.id;
  if (player.voiceId && player.voiceId !== voiceChannel.id) {
    player.setVoiceChannel(voiceChannel.id);
  }

  if (result.type === 'PLAYLIST') {
    const firstTrack = result.tracks[0];
    const playlistCount = result.tracks.length;
    addTracks(player, result.tracks, message.author);
    player.queue.add(result.tracks);
    const thumbnail = firstTrack?.thumbnail ?? extractThumbnail(firstTrack) ?? undefined;
    if (loadingMsg) {
      await sendPlaylistAddedMessage(
        { message, existingMessage: loadingMsg as any },
        { name: result.playlistName || query, trackCount: playlistCount, thumbnail },
      );
    }
  } else {
    const track = result.tracks[0];
    player.queue.add(track);
    addTracks(player, [track], message.author);
    const queuePos = player.queue.length;
    const thumbnail = track.thumbnail ?? extractThumbnail(track) ?? undefined;
    if (loadingMsg) {
      await sendTrackAddedMessage(
        { message, existingMessage: loadingMsg as any },
        {
          title: track.title,
          author: track.author || 'Unknown',
          duration: track.length ? formatDuration(track.length) : 'LIVE',
          position: queuePos,
          url: track.uri,
          thumbnail,
        },
      );
    }
  }

  if (!player.playing && !player.paused) {
    await player.play().catch((): null => null);
  } else if (player.paused) {
    player.pause(false);
    await updateNowPlayingMessage(client, player).catch((): null => null);
  } else {
    await updateNowPlayingMessage(client, player).catch((): null => null);
  }
}
