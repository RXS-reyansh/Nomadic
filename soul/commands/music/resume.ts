// soul/commands/music/resume.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';

export const options = {
  name: 'resume',
  aliases: [] as string[],
  description: 'Resume the currently paused track.',
  usage: 'resume',
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

  if (!player || !player.queue?.current) return sendError(ctxObj, 'There is nothing currently playing.');
  if (!player.paused) return sendError(ctxObj, 'The player is not paused.');

  // Kazagumo: pause(false) resumes playback
  player.pause(false);
  return sendSuccess(ctxObj, 'Resumed the player.');
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  await handle({ message, isSlash: false }, message.guild.id, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  await handle({ interaction, isSlash: true }, interaction.guild.id, client);
}
