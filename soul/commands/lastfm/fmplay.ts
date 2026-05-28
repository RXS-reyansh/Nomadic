// soul/commands/lastfm/fmplay.ts
//
// Two modes:
//   • `fmplay`              → play your most-recent scrobble
//   • `fmplay <artist> - <track>`  → play a specific track via Last.fm lookup
// Either way the resolved query goes through `unifiedSearch` and joins the
// normal queue/player flow.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError } from '../../components/statusMessages.js';
import {
  sendLoadingMessage,
  sendTrackAddedMessage,
  sendPlaylistAddedMessage,
} from '../../components/addedToQueue.js';
import { extractThumbnail, formatDuration } from '../../utils/formatting.js';
import { unifiedSearch } from '../../helpers/sourceSearch.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';
import { addTracks } from '../../helpers/sessionQueue.js';
import { isLastfmConfigured, userGetRecentTracks } from '../../helpers/lastfmClient.js';

export const options = {
  name: 'fmplay',
  aliases: ['fmp'] as string[],
  description: 'Play your most-recent Last.fm scrobble (or a specific track).',
  usage: `fmplay
  fmplay <artist> - <track>`,
  category: 'lastfm',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  cooldown: 5,
};

async function playQuery(message: any, client: HermacaClient, query: string, displayQuery: string) {
  const ctx = { message };
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return sendError(ctx, 'You must be in a voice channel.');

  const loadingMsg = await sendLoadingMessage(ctx, displayQuery);
  let result: any;
  try {
    result = await unifiedSearch(client, query, message.author);
  } catch {
    return sendError(ctx, 'Failed to search for that track. Please try again.');
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
        { name: result.playlistName || displayQuery, trackCount: playlistCount, thumbnail },
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

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  if (!isLastfmConfigured()) return sendError(ctx, 'Last.fm integration is not configured.');

  const joined = args.join(' ').trim();
  if (joined && joined.includes(' - ')) {
    return playQuery(message, client, joined, joined);
  }

  // Default: most recent scrobble for the invoker.
  const username = await client.db.getLastfmUsername(message.author.id);
  if (!username) {
    return sendError(
      ctx,
      `You haven't linked Last.fm. Use \`${client.config.prefix}linklastfm <username>\` first, or call this command as \`fmplay <artist> - <track>\`.`,
    );
  }
  const recent = await userGetRecentTracks(username, 1);
  const tracks: any[] = Array.isArray(recent?.track) ? recent.track : recent?.track ? [recent.track] : [];
  if (!tracks.length) return sendError(ctx, "Couldn't find any recent scrobbles to replay.");
  const t = tracks[0];
  const artistName = typeof t.artist === 'string' ? t.artist : t.artist?.['#text'] ?? t.artist?.name ?? 'Unknown';
  const q = `${artistName} - ${t.name}`;
  return playQuery(message, client, q, q);
}
