// soul/commands/music/remove.ts
//
// Remove a track at a specific queue position.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'remove',
  aliases: ['rm'] as string[],
  description: 'Remove a track at the given queue position.',
  usage: 'remove <position>',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  cooldown: 2,
};

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guildId: string,
  position: number,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;
  if (!player) return sendError(ctxObj, 'There is no active player in this server.');
  if (player.queue.length === 0) return sendError(ctxObj, 'The queue is empty.');
  if (position < 1 || position > player.queue.length) {
    return sendError(ctxObj, `Position must be between 1 and ${player.queue.length}.`);
  }

  // KazagumoQueue extends Array — splice removes in place.
  const [removed] = player.queue.splice(position - 1, 1);
  await updateNowPlayingMessage(client, player).catch((): null => null);
  return sendSuccess(ctxObj, `Removed **${removed?.title ?? 'track'}** from position **#${position}**.`);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);
  const pos = parseInt(args[0], 10);
  if (isNaN(pos) || pos < 1) return sendError({ message }, 'Please provide a valid position number.');
  await handle({ message, isSlash: false }, message.guild.id, pos, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const pos = interaction.options.getInteger('position', true);
  await handle({ interaction, isSlash: true }, interaction.guild.id, pos, client);
}
