// soul/commands/spotify/playspotify.ts
//
// Fetch the invoker's public Spotify playlists and present them in a String
// Select Menu. On select, hand the playlist URL to `unifiedSearch` →
// LavaSrc resolves it as a PLAYLIST and the standard play flow takes over.
//
// This is the "basic" version per the user request — improvements (paging,
// thumbnails, multi-page select) come later.

import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  MessageFlags,
} from 'discord.js';
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
  isSpotifyConfigured,
  getUserPlaylists,
  type SpotifyPlaylistSummary,
} from '../../helpers/spotifyClient.js';

export const options = {
  name: 'playspotify',
  aliases: [] as string[],
  description: 'Pick one of your linked Spotify profile\'s public playlists to play.',
  usage: 'playspotify',
  category: 'spotify',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: true,
  sameVoiceChannel: false,
  cooldown: 5,
};

const NO_MENTIONS = { parse: [] as any[] };

function buildPickerPayload(
  username: string,
  playlists: SpotifyPlaylistSummary[],
  customId: string,
): any {
  // Discord caps select menus at 25 options. Take the first 25 — the user said
  // "basic message right now, I will improve it later."
  const visible = playlists.slice(0, 25);

  const lines = visible
    .map((p, i) => `**${i + 1}.** ${p.name} — \`${p.trackCount}\` tracks`)
    .join('\n');

  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Pick a playlist to play')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      visible.map((p, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(p.name.slice(0, 100))
          .setValue(p.id)
          .setDescription(`${p.trackCount} tracks`.slice(0, 100))
          .setEmoji({ name: `${(i + 1) % 10}️⃣` } as any),
      ),
    );

  const totalNote =
    playlists.length > visible.length
      ? `-# Showing the first **${visible.length}** of **${playlists.length}** public playlists.`
      : `-# **${playlists.length}** public playlist${playlists.length === 1 ? '' : 's'}.`;

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${username}'s Spotify playlists`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as any,
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(totalNote));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}

function buildDisabledPayload(username: string, footer: string): any {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${username}'s Spotify playlists`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const ctx = { message };

  if (!isSpotifyConfigured()) {
    return sendError(ctx, 'Spotify integration is not configured on this bot. Please ask the developer.');
  }

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return sendError(ctx, 'You must be in a voice channel.');

  const link = await client.db.getSpotifyLink(message.author.id);
  if (!link) {
    return sendInfo(
      ctx,
      `You haven't linked a Spotify account yet. Use \`${client.config.prefix}linkspotify <id or URL>\` first.`,
    );
  }

  const playlists = await getUserPlaylists(link.spotify_id, 100);
  if (!playlists.length) {
    return sendInfo(ctx, "Couldn't find any public playlists on that Spotify profile.");
  }

  const username = link.display_name || link.spotify_id;
  const customId = `playspotify:${message.id}`;
  const picker = await message.reply(buildPickerPayload(username, playlists, customId)).catch((): null => null);
  if (!picker) return;

  const collector = picker.createMessageComponentCollector({
    filter: (i: any) => i.customId === customId && i.user.id === message.author.id,
    time: 60_000,
    max: 1,
  });

  collector.on('collect', async (i: any) => {
    await i.deferUpdate().catch((): null => null);
    const chosen = playlists.find((p) => p.id === i.values[0]);
    if (!chosen) return;
    await picker.delete().catch((): null => null);

    // Re-validate VC at click-time — user might have left.
    const vc = message.member?.voice?.channel;
    if (!vc) return sendError(ctx, 'You left the voice channel before picking a playlist.');

    const loadingMsg = await sendLoadingMessage(ctx, chosen.name);
    let result: any;
    try {
      result = await unifiedSearch(client, chosen.externalUrl, message.author);
    } catch {
      return sendError(ctx, 'Failed to load that playlist. Try again in a moment.');
    }
    if (!result?.tracks?.length) {
      return sendError(ctx, 'That playlist came back empty.');
    }

    const player = await client.kazagumo.createPlayer({
      guildId: message.guild.id,
      voiceId: vc.id,
      textId: message.channel.id,
      deaf: true,
      volume: 100,
    });
    player.textId = message.channel.id;
    if (player.voiceId && player.voiceId !== vc.id) {
      player.setVoiceChannel(vc.id);
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
          {
            name: result.playlistName || chosen.name,
            trackCount: playlistCount,
            thumbnail,
          },
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
  });

  collector.on('end', async (collected: any, reason: string) => {
    if (reason === 'time' && collected.size === 0) {
      await picker
        .edit(buildDisabledPayload(username, '-# Selection timed out.'))
        .catch((): null => null);
    }
  });
}
