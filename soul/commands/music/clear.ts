// soul/commands/music/clear.ts
//
// Clear all upcoming tracks from the queue (does NOT stop the current track).

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'clear',
  aliases: ['cl'] as string[],
  description: 'Clear all upcoming tracks from the queue.',
  usage: 'clear',
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
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;
  if (!player) return sendError(ctxObj, 'There is no active player in this server.');

  const count = player.queue.length;
  if (count === 0) return sendInfo(ctxObj, 'The queue is already empty.');

  player.queue.clear();
  await updateNowPlayingMessage(client, player).catch((): null => null);
  return sendSuccess(ctxObj, `Cleared **${count}** track${count !== 1 ? 's' : ''} from the queue.`);
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  await handle({ message, isSlash: false }, message.guild.id, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  await handle({ interaction, isSlash: true }, interaction.guild.id, client);
}
