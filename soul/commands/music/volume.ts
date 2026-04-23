// soul/commands/music/volume.ts
//
// Set the playback volume for the current player. Persists until the queue
// ends (resets to default / saved server volume on the next createPlayer).
// For permanent changes use `servervolume`.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'volume',
  aliases: ['vol', 'v'] as string[],
  description: 'Set the playback volume (0-200). Resets when the queue ends.',
  usage: 'volume <0-200>',
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
  volume: number,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;
  if (!player) return sendError(ctxObj, 'There is no active player in this server.');
  if (volume < 0 || volume > 200) return sendError(ctxObj, 'Volume must be between 0 and 200.');

  await player.setVolume(volume).catch((): null => null);
  await updateNowPlayingMessage(client, player).catch((): null => null);
  return sendSuccess(ctxObj, `Volume set to **${volume}%**.`);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);
  const v = parseInt(args[0], 10);
  if (isNaN(v)) return sendError({ message }, 'Please provide a valid number.');
  await handle({ message, isSlash: false }, message.guild.id, v, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const v = interaction.options.getInteger('volume', true);
  await handle({ interaction, isSlash: true }, interaction.guild.id, v, client);
}
