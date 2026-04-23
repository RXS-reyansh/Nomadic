// soul/commands/music/play.ts
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

export const options = {
  name: 'play',
  aliases: ['p'] as string[],
  description: 'Play a song or add it to the queue.',
  usage: 'play <song name or URL>',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  cooldown: 3,
};

async function handle(
  ctx: { guild: any; user: any; voiceChannel: any; textChannelId: string; message?: any; interaction?: any; isSlash: boolean },
  query: string,
  client: HermacaClient,
) {
  const { guild, user, voiceChannel, textChannelId, message, interaction, isSlash } = ctx;
  const ctxObj = isSlash ? { interaction } : { message };

  if (!query) return sendError(ctxObj, 'Please provide a song name or URL.');

  const loadingMsg = await sendLoadingMessage(ctxObj as any, query);

  let result: any;
  try {
    // Custom search — bypasses Kazagumo's restricted built-in search() so we
    // can use any source supported by LavaSrc on the Lavalink node:
    //   • URLs (Spotify / Deezer / Apple Music / SoundCloud / YouTube / …)
    //     are passed through unchanged so LavaSrc can resolve them natively.
    //   • Source-prefixed queries (`spsearch:`, `dzsearch:`, `amsearch:`,
    //     `ymsearch:`, `ytmsearch:`, `ytsearch:`, `scsearch:`) pass through.
    //   • Plain text uses `config.defaultSource` as the prefix.
    result = await unifiedSearch(client, query, user);
  } catch (err) {
    return sendError(ctxObj, 'Failed to search for that song. Please try again.');
  }

  // Kazagumo result.type: 'PLAYLIST' | 'TRACK' | 'SEARCH' (no EMPTY/ERROR variants in v3)
  if (!result?.tracks?.length) {
    return sendError(ctxObj, 'No results found for your query.');
  }

  // Kazagumo: createPlayer is async and uses voiceId/textId instead of voiceChannel/textChannel.
  // If a player already exists (e.g. auto-joined for 24/7), Kazagumo returns it as-is — so
  // we explicitly:
  //   • update textId so the now-playing message lands in the channel where play was invoked
  //   • move the bot via setVoiceChannel() if the user is in a different VC than where the
  //     bot currently sits (this is what makes 24/7 follow the user; without it the bot would
  //     just keep playing in the 24/7 channel and ignore the requester's actual VC).
  const player = await client.kazagumo.createPlayer({
    guildId: guild.id,
    voiceId: voiceChannel.id,
    textId: textChannelId,
    deaf: true,
    volume: 100,
  });
  player.textId = textChannelId;
  if (player.voiceId && player.voiceId !== voiceChannel.id) {
    player.setVoiceChannel(voiceChannel.id);
  }

  if (result.type === 'PLAYLIST') {
    // Kazagumo: requester is passed to search() and stored on each track automatically
    player.queue.add(result.tracks);

    const firstTrack = result.tracks[0];
    // Kazagumo tracks are flat — thumbnail is direct property, fall back to extractThumbnail
    const thumbnail = firstTrack?.thumbnail ?? extractThumbnail(firstTrack) ?? undefined;

    if (loadingMsg) {
      await sendPlaylistAddedMessage(
        isSlash ? { interaction } : { message, existingMessage: loadingMsg as any },
        {
          name: result.playlistName || 'Unknown Playlist',
          trackCount: result.tracks.length,
          thumbnail,
        },
      );
    }
  } else {
    const track = result.tracks[0];
    player.queue.add(track);

    const queuePos = player.queue.length;
    // Kazagumo tracks are flat — no .info wrapper
    const thumbnail = track.thumbnail ?? extractThumbnail(track) ?? undefined;

    if (loadingMsg) {
      await sendTrackAddedMessage(
        isSlash ? { interaction } : { message, existingMessage: loadingMsg as any },
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

  // Only call play() when player is idle (no current track and not playing).
  // If paused, resume via pause(false) — calling play() when current is set replays current.
  if (!player.playing && !player.paused) {
    await player.play().catch((): null => null);
  } else if (player.paused) {
    player.pause(false);
    // Refresh the existing now-playing panel so the queue count updates.
    await updateNowPlayingMessage(client, player).catch((): null => null);
  } else {
    // Already playing — refresh the now-playing panel for the new queue count.
    await updateNowPlayingMessage(client, player).catch((): null => null);
  }
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const query = args.join(' ');
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return sendError({ message }, 'You must be in a voice channel.');

  await handle(
    {
      guild: message.guild,
      user: message.author,
      voiceChannel,
      textChannelId: message.channel.id,
      message,
      isSlash: false,
    },
    query,
    client,
  );
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  const query = interaction.options.getString('song', true);
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) return sendError({ interaction }, 'You must be in a voice channel.');

  await handle(
    {
      guild: interaction.guild,
      user: interaction.user,
      voiceChannel,
      textChannelId: interaction.channel.id,
      interaction,
      isSlash: true,
    },
    query,
    client,
  );
}
