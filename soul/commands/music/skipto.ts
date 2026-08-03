// soul/commands/music/skipto.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { getSession } from '../../helpers/sessionQueue.js';

export const options = {
  name: 'skipto',
  aliases: ['st'] as string[],
  description: 'Skip to a specific track position in the queue.',
  usage: 'skipto <position>',
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

  if (!player || !player.queue?.current) return sendError(ctxObj, 'There is nothing currently playing.');
  if (!player.queue.length) return sendError(ctxObj, 'The queue is empty.');

  // The queue panel numbers every entry as (absIndex + 1), where absIndex is
  // its position in the session entries array.  player.queue holds only the
  // *upcoming* tracks (the current track is NOT included), so the first
  // upcoming track is displayed as (currentIndex + 2).
  //
  //   player.queue[i]  ←→  session entry (currentIndex + 1 + i)
  //                    displayed as  (currentIndex + 2 + i)
  //
  // To play the entry shown as `position`, we remove (position - currentIndex - 2)
  // items from the front of the queue, then skip() fires TrackEnd which plays
  // what is now at the front.
  const state = getSession(player);
  const currentIdx: number = state.currentIndex;  // -1 if no track has started

  // queueBase = display number of player.queue[0]
  const queueBase = currentIdx + 2;               // (-1+2=1) when nothing has played yet
  const minPos = queueBase;
  const maxPos = queueBase + player.queue.length - 1;

  if (position < minPos || position > maxPos) {
    return sendError(ctxObj, `Position must be between **${minPos}** and **${maxPos}**.`);
  }

  const spliceCount = position - queueBase;        // 0 = play queue[0] as-is
  if (spliceCount > 0) player.queue.splice(0, spliceCount);
  player.skip();

  return sendSuccess(ctxObj, `Skipped to position **#${position}** in the queue.`);
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
