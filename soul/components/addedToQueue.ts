// soul/components/addedToQueue.ts
import {
  type Message,
  type ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

export interface TrackInfo {
  title: string;
  author: string;
  duration: string;
  position: number;
  url?: string;
  thumbnail?: string;
}

export interface PlaylistInfo {
  name: string;
  trackCount: number;
  url?: string;
  thumbnail?: string;
}

type Context =
  | { interaction: ChatInputCommandInteraction; message?: never; existingMessage?: never }
  | { message: Message; existingMessage?: Message; interaction?: never };

function isInteraction(ctx: Context): ctx is { interaction: ChatInputCommandInteraction } {
  return 'interaction' in ctx && !!ctx.interaction;
}

type LoadingType = 'search' | 'track' | 'playlist';

export async function sendLoadingMessage(
  ctx: Context,
  query: string,
  loadingType: LoadingType = 'search',
): Promise<Message | void> {
  let content: string;
  switch (loadingType) {
    case 'track':
      content = `# ${emojis.loading} Adding **${query}**...`;
      break;
    case 'playlist':
      content = `# ${emojis.loading} Adding the playlist **${query}**...`;
      break;
    default:
      content = `# ${emojis.loading} Searching for **"${query}"**...`;
  }

  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(content),
  );

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };

  if (isInteraction(ctx)) {
    if (!ctx.interaction.deferred) await ctx.interaction.deferReply();
    return await ctx.interaction.editReply(payload as any);
  } else {
    const target = ctx.existingMessage || ctx.message;
    if (target.editable) {
      return await target.edit(payload as any);
    } else {
      return await (ctx.message.channel as any).send(payload as any);
    }
  }
}

export async function sendTrackAddedMessage(
  ctx: Context,
  track: TrackInfo,
): Promise<Message | void> {
  const titleLink = track.url ? `[${track.title}](${track.url})` : track.title;

  const detailsSection = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `- **Artist:** ${track.author}\n- **Duration:** ${track.duration}\n- **Position in queue:** #${track.position}`,
    ),
  );

  if (track.thumbnail) {
    detailsSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(track.thumbnail));
  }

  const container = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${emojis.blacktick} **${titleLink}** added to queue.`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addSectionComponents(detailsSection);

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };

  if (isInteraction(ctx)) {
    return await ctx.interaction.editReply(payload as any);
  } else {
    const target = ctx.existingMessage || ctx.message;
    if (!target) throw new Error('No target message to edit');
    return await target.edit(payload as any);
  }
}

export async function sendPlaylistAddedMessage(
  ctx: Context,
  playlist: PlaylistInfo,
  firstTrack?: TrackInfo,
): Promise<Message | void> {
  const titleLink = playlist.url ? `[${playlist.name}](${playlist.url})` : playlist.name;
  const thumbnailUrl = playlist.thumbnail || firstTrack?.thumbnail;

  const detailsSection = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `- **Name:** ${titleLink}\n- **Tracks:** ${playlist.trackCount}`,
    ),
  );

  if (thumbnailUrl) {
    detailsSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
  }

  const container = new ContainerBuilder()
    .setAccentColor(0x1db954)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ${emojis.blacktick} Added **${playlist.trackCount}** tracks from **${titleLink}**`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addSectionComponents(detailsSection);

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };

  if (isInteraction(ctx)) {
    return await ctx.interaction.editReply(payload as any);
  } else {
    const target = ctx.existingMessage || ctx.message;
    return await (target as any).edit(payload as any);
  }
}
