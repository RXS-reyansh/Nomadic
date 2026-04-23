// soul/commands/music/skipto.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';

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

  if (position < 1 || position > player.queue.length) {
    return sendError(ctxObj, `Position must be between 1 and ${player.queue.length}.`);
  }

  // Remove all tracks before the target position, then skip to play it
  // KazagumoQueue extends Array — splice works directly
  player.queue.splice(0, position - 1);
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
