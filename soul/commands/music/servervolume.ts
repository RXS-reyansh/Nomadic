// soul/commands/music/servervolume.ts
//
// Set the persistent server-wide volume. Saved to the database and
// re-applied to every newly-created player in this guild. Also applied
// to the current player (if any).
//
// `servervolume reset` removes the saved value and falls back to the
// Kazagumo default (100) for new players.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'servervolume',
  aliases: ['svol', 'sv'] as string[],
  description: 'Set or reset the persistent server-wide playback volume.',
  usage: `servervolume <0-200>
  servervolume reset`,
  category: 'music',
  isDeveloper: false,
  userPerms: ['ManageGuild'] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guildId: string,
  arg: string,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;

  if (arg.toLowerCase() === 'reset') {
    const removed = await client.db.removeGuildVolume(guildId);
    if (player) player.data?.set?.('serverVolume', undefined);
    if (!removed) return sendInfo(ctxObj, 'No server volume was set.');
    if (player) await updateNowPlayingMessage(client, player).catch((): null => null);
    return sendSuccess(ctxObj, 'Server volume reset. New players will use the default volume.');
  }

  const v = parseInt(arg, 10);
  if (isNaN(v)) return sendError(ctxObj, 'Please provide a valid number, or `reset`.');
  if (v < 0 || v > 200) return sendError(ctxObj, 'Volume must be between 0 and 200.');

  await client.db.setGuildVolume(guildId, v);

  if (player) {
    player.data?.set?.('serverVolume', v);
    await player.setVolume(v).catch((): null => null);
    await updateNowPlayingMessage(client, player).catch((): null => null);
  }

  return sendSuccess(ctxObj, `Server volume set to **${v}%**. This will persist for all future players.`);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);
  await handle({ message, isSlash: false }, message.guild.id, args[0], client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  // Slash form: required `value` is either a number string or "reset"
  const value = interaction.options.getString('value', true);
  await handle({ interaction, isSlash: true }, interaction.guild.id, value, client);
}
