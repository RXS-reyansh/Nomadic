// soul/commands/developer/restart-bot.ts
import type { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  buildBotActionConfirmPayload,
  buildBotActionTimedOutPayload,
} from '../../components/botActionConfirm.js';

export const options = {
  name: 'restart-bot',
  aliases: ['res-bot'] as string[],
  description: 'Restart the bot. (Developer only)',
  usage: 'restart-bot',
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 0,
};

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const confirmId = `restart-bot:confirm:${message.id}`;
  const cancelId  = `restart-bot:cancel:${message.id}`;

  const botName: string = (client as any).config?.botName ?? 'Bot';

  // Kazagumo: players Map lives on client.kazagumo.players
  const activePlayers: number = (client as any).kazagumo?.players?.size ?? 0;
  const activeRequests: number = typeof (process as any)._getActiveRequests === 'function'
    ? (process as any)._getActiveRequests().length
    : 0;

  const confirmMsg = await message.reply({
    ...buildBotActionConfirmPayload('restart', confirmId, cancelId, activePlayers, activeRequests),
    allowedMentions: { repliedUser: true },
  });

  const collector = confirmMsg.createMessageComponentCollector({
    filter: (i: any) =>
      (i.customId === confirmId || i.customId === cancelId) &&
      i.user.id === message.author.id,
    max: 1,
    time: 30_000,
  });

  collector.on('collect', async (i: any) => {
    await i.deferUpdate().catch((): null => null);

    if (i.customId === confirmId) {
      await sendInfo(
        { message, existingMessage: confirmMsg },
        `Bot restart initiated. **${botName}** will restart soon.`,
      );

      // Store the channel so ready.ts can send the post-restart notification
      if (client.db?.setPendingRestartChannel) {
        await client.db.setPendingRestartChannel(
          message.channel.id,
          message.guild?.id ?? '',
        ).catch((): null => null);
      }

      setTimeout(() => {
        // Sends a request to the ClusterManager to respawn all clusters.
        // The manager (index.ts) has respawn: true so all clusters come back up.
        (client as any).cluster?.respawnAll().catch((): null => null);
      }, 2000);
    } else {
      await sendError(
        { message, existingMessage: confirmMsg },
        'Bot restart cancelled. Right decision?',
      );
    }
  });

  collector.on('end', (_collected: any, reason: string) => {
    if (reason !== 'time') return;
    confirmMsg
      .edit(buildBotActionTimedOutPayload('restart', confirmId, cancelId, activePlayers, activeRequests))
      .catch((): null => null);
  });
}
