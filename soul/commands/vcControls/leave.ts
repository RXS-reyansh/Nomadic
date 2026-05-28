import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError } from '../../components/statusMessages.js';
import { disableNowPlayingButtons, clearPlayerState } from '../../helpers/nowPlayingManager.js';
import { scheduleRejoin } from '../../helpers/twentyFourSeven.js';

export const options = {
  name: 'leave',
  aliases: [] as string[],
  description: 'Make the bot leave the voice channel.',
  usage: 'leave',
  category: 'vcControls',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

async function handle(ctx: any, client: HermacaClient, guildId: string) {
  const player: any = client.kazagumo.players.get(guildId);
  if (!player) return sendError(ctx, 'I am not in any voice channel.');

  const channelId: string = player.voiceId;

  await disableNowPlayingButtons(client, player).catch((): null => null);
  await player.destroy().catch((): null => null);
  clearPlayerState(guildId);

  // 24/7 rejoin: if 24/7 is enabled for this guild, schedule a rejoin to the
  // configured channel. We do this explicitly here because the playerDestroy
  // event handler calls clearRejoin(), which would cancel any rejoin scheduled
  // by the voiceStateUpdate handler. Scheduling here (after destroy resolves)
  // guarantees the rejoin survives.
  const settings = await client.db?.get24Seven(guildId).catch((): null => null);
  if (settings?.enabled) {
    scheduleRejoin(client, guildId, settings.channelId, 2000);
    return sendSuccess(
      ctx,
      `Left <#${channelId}>. Rejoining 24/7 channel <#${settings.channelId}> shortly.`,
    );
  }

  return sendSuccess(ctx, `Left <#${channelId}>.`);
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  return handle({ message }, client, message.guild.id);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const ctx = { interaction };
  if (!interaction.guild) return sendError(ctx, 'This command can only be used in a server.');
  return handle(ctx, client, interaction.guild.id);
}
