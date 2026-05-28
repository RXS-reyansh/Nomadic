// soul/commands/music/shuffle.ts
//
// Shuffle the upcoming queue (does not affect the currently playing track).

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';
import { getSession, shuffleUpcoming } from '../../helpers/sessionQueue.js';

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

  // Shuffle the session-queue's upcoming entries first, then mirror that
  // order onto player.queue so both stay in lock-step (using two independent
  // Fisher–Yates shuffles would diverge the two views).
  shuffleUpcoming(player);

  const state = getSession(player);
  const upcomingTracks = state.entries
    .slice(state.currentIndex + 1)
    .map(e => e.track);
  player.queue.length = 0;
  for (const t of upcomingTracks) player.queue.push(t);

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
