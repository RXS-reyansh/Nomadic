// soul/commands/music/grab.ts
//
// DM the requester with the currently-playing track's details
// (title, artist, link, thumbnail, original requester).

import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { extractThumbnail, formatDuration } from '../../utils/formatting.js';

export const options = {
  name: 'grab',
  aliases: ['save'] as string[],
  description: 'DM yourself the details of the currently playing track.',
  usage: 'grab',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: true,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

function buildPayload(track: any): any {
  const thumb = track.thumbnail ?? extractThumbnail(track) ?? null;
  const lines = [
    `## ${track.title}`,
    `**Artist:** ${track.author || 'Unknown'}`,
    `**Duration:** ${track.length ? formatDuration(track.length) : 'LIVE'}`,
    track.uri ? `**Link:** ${track.uri}` : null,
    track.requester?.username ? `**Originally requested by:** ${track.requester.username}` : null,
  ].filter(Boolean) as string[];

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

  if (thumb) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(thumb)),
    );
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean; user: any },
  guildId: string,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;
  if (!player?.queue?.current) return sendError(ctxObj, 'There is nothing currently playing.');

  const track = player.queue.current;
  const dm = await ctx.user.createDM().catch((): null => null);
  if (!dm) return sendError(ctxObj, 'I could not DM you. Please enable DMs from server members.');

  const sent = await dm.send(buildPayload(track)).catch((): null => null);
  if (!sent) return sendError(ctxObj, 'I could not send you a DM.');

  return sendSuccess(ctxObj, 'Sent you the track details in your DMs.');
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  await handle({ message, isSlash: false, user: message.author }, message.guild.id, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply({ ephemeral: true });
  await handle({ interaction, isSlash: true, user: interaction.user }, interaction.guild.id, client);
}
