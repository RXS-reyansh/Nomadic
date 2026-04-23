// soul/commands/music/move.ts
//
// Move a track from one queue position to another.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'move',
  aliases: ['mv'] as string[],
  description: 'Move a queued track to a new position.',
  usage: 'move <from> <to>',
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
  from: number,
  to: number,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;
  if (!player) return sendError(ctxObj, 'There is no active player in this server.');

  const len = player.queue.length;
  if (len < 2) return sendError(ctxObj, 'Need at least 2 tracks in the queue to move.');
  if (from < 1 || from > len) return sendError(ctxObj, `\`from\` must be between 1 and ${len}.`);
  if (to < 1 || to > len) return sendError(ctxObj, `\`to\` must be between 1 and ${len}.`);
  if (from === to) return sendError(ctxObj, '`from` and `to` are the same.');

  const [track] = player.queue.splice(from - 1, 1);
  player.queue.splice(to - 1, 0, track);
  await updateNowPlayingMessage(client, player).catch((): null => null);
  return sendSuccess(ctxObj, `Moved **${track?.title ?? 'track'}** from **#${from}** to **#${to}**.`);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (args.length < 2) return sendWrongUsage({ message, client }, options.name, options.usage);
  const from = parseInt(args[0], 10);
  const to = parseInt(args[1], 10);
  if (isNaN(from) || isNaN(to)) return sendError({ message }, 'Please provide two valid position numbers.');
  await handle({ message, isSlash: false }, message.guild.id, from, to, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const from = interaction.options.getInteger('from', true);
  const to = interaction.options.getInteger('to', true);
  await handle({ interaction, isSlash: true }, interaction.guild.id, from, to, client);
}
