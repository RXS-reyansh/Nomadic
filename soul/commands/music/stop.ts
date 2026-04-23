// soul/commands/music/stop.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { disableNowPlayingButtons, clearPlayerState } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'stop',
  aliases: [] as string[],
  description: 'Stop playback, clear the queue, and leave the voice channel.',
  usage: 'stop',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  cooldown: 3,
};

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guildId: string,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;

  if (!player) return sendError(ctxObj, 'There is no active player in this server.');

  // If 24/7 mode is enabled, stay connected — just stop playback and clear the queue.
  const is247 = await client.db?.get24Seven(guildId).catch((): null => null);

  if (is247?.enabled) {
    await disableNowPlayingButtons(client, player);
    player.queue.clear();
    if (player.queue.current) {
      // Kazagumo: player.skip() is synchronous and returns the player itself —
      // it is NOT a Promise, so do NOT await or .catch() it.
      player.skip();
    }
    return sendSuccess(
      ctxObj,
      'Stopped playback and cleared the queue. (24/7 mode is enabled — staying in the voice channel.)',
    );
  }

  await disableNowPlayingButtons(client, player);
  clearPlayerState(guildId);
  // Kazagumo: player.destroy() stops playback, clears the player, and disconnects
  await player.destroy().catch((): null => null);

  return sendSuccess(ctxObj, 'Stopped playback and left the voice channel.');
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  await handle({ message, isSlash: false }, message.guild.id, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  await handle({ interaction, isSlash: true }, interaction.guild.id, client);
}
