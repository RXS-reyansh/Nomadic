// soul/commands/music/shuffle.ts
//
// Shuffle the upcoming queue (does not affect the currently playing track).

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'shuffle',
  aliases: ['sh'] as string[],
  description: 'Shuffle the upcoming queue.',
  usage: 'shuffle',
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
  if (player.queue.length < 2) return sendError(ctxObj, 'Need at least 2 tracks in the queue to shuffle.');

  // Fisher–Yates shuffle of the upcoming-queue array (KazagumoQueue extends Array)
  for (let i = player.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [player.queue[i], player.queue[j]] = [player.queue[j], player.queue[i]];
  }

  await updateNowPlayingMessage(client, player).catch((): null => null);
  return sendSuccess(ctxObj, `Shuffled **${player.queue.length}** tracks in the queue.`);
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  await handle({ message, isSlash: false }, message.guild.id, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  await handle({ interaction, isSlash: true }, interaction.guild.id, client);
}
