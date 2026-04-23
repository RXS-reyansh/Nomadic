// soul/commands/music/nowplaying.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError } from '../../components/statusMessages.js';
import { sendNowPlaying } from '../../components/nowPlaying.js';
import { buildTrackInfo } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'nowplaying',
  aliases: ['np'] as string[],
  description: 'Show the now playing panel for the current track.',
  usage: 'nowplaying',
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
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  // Kazagumo: kazagumo.players.get() instead of riffy.players.get()
  const player = client.kazagumo.players.get(guildId) as any;

  // Kazagumo: current track lives at player.queue.current, not player.current
  if (!player || !player.queue?.current) return sendError(ctxObj, 'There is nothing currently playing.');

  const trackInfo = buildTrackInfo(player, player.queue.current);
  const prefix = client.config?.prefix;

  await sendNowPlaying(ctxObj as any, player, trackInfo, { prefix });
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  await handle({ message, isSlash: false }, message.guild.id, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await handle({ interaction, isSlash: true }, interaction.guild.id, client);
}
