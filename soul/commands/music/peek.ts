// soul/commands/music/peek.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { sendNowPlaying } from '../../components/nowPlaying.js';
import { extractThumbnail, formatDuration } from '../../utils/formatting.js';

export const options = {
  name: 'peek',
  aliases: [] as string[],
  description: 'Preview a track in the queue without playing it.',
  usage: 'peek <position>',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: true,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guildId: string,
  position: number,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  // Kazagumo: kazagumo.players.get() instead of riffy.players.get()
  const player = client.kazagumo.players.get(guildId) as any;

  if (!player || !player.queue?.current) return sendError(ctxObj, 'There is nothing currently playing.');
  if (!player.queue.length) return sendError(ctxObj, 'The queue is empty.');

  if (position < 1 || position > player.queue.length) {
    return sendError(ctxObj, `Position must be between 1 and ${player.queue.length}.`);
  }

  const track = player.queue[position - 1];
  if (!track) return sendError(ctxObj, 'Could not find that track in the queue.');

  // Kazagumo: tracks are flat — no .info wrapper
  const trackInfo = {
    title: track.title,
    artist: track.author || 'Unknown',
    url: track.uri,
    sourceName: track.sourceName || 'Unknown',
    durationFormatted: track.length ? formatDuration(track.length) : 'LIVE',
    currentFormatted: '00:00',
    progress: 0,
    thumbnailUrl: track.thumbnail ?? extractThumbnail(track) ?? undefined,
    volume: player.volume ?? 100,
    requestedBy: (track.requester as any)?.username,
  };

  await sendNowPlaying(ctxObj as any, player, trackInfo, { isPeek: true });
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);
  const position = parseInt(args[0], 10);
  if (isNaN(position) || position < 1) {
    return sendError({ message }, 'Please provide a valid position number.');
  }
  await handle({ message, isSlash: false }, message.guild.id, position, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const position = interaction.options.getInteger('position', true);
  await handle({ interaction, isSlash: true }, interaction.guild.id, position, client);
}
