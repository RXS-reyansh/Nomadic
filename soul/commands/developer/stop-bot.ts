// soul/commands/developer/stop-bot.ts
//
// Kills the entire bot — manager process and every cluster — by evaluating
// `process.exit(0)` on the ClusterManager. Because `respawn: true` only
// respawns crashed *child* clusters, exiting the *manager* takes the whole
// bot down for good.
//
// There is intentionally NO `start-bot` command: once the bot process is
// dead, nothing inside Discord can wake it back up. Restart has to come
// from outside (PM2 / systemd / Docker / hosting panel).

import type { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';
import {
  buildBotActionConfirmPayload,
  buildBotActionTimedOutPayload,
} from '../../components/botActionConfirm.js';

export const options = {
  name: 'stop-bot',
  aliases: ['s-bot'] as string[],
  description: 'Stop the bot completely. (Developer only)',
  usage: 'stop-bot',
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
  const confirmId = `stop-bot:confirm:${message.id}`;
  const cancelId  = `stop-bot:cancel:${message.id}`;

  const botName: string = (client as any).config?.botName ?? 'Bot';

  const activePlayers: number = (client as any).kazagumo?.players?.size ?? 0;
  const activeRequests: number = typeof (process as any)._getActiveRequests === 'function'
    ? (process as any)._getActiveRequests().length
    : 0;

  const confirmMsg = await message.reply({
    ...buildBotActionConfirmPayload('stop', confirmId, cancelId, activePlayers, activeRequests),
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
        `Bot shutdown initiated. **${botName}** will stop in a moment.`,
      );

      // Wait briefly so the edit reaches Discord before the process dies.
      setTimeout(() => {
        // Run process.exit(0) inside the ClusterManager process — kills the
        // parent and (with it) every child cluster. respawn:true only covers
        // crashed children, so killing the manager itself stops everything.
        (client as any).cluster
          ?.evalOnManager('process.exit(0)')
          .catch((): null => null);

        // Belt-and-braces: if evalOnManager somehow doesn't take down this
        // child, kill the local cluster too after a short grace period.
        setTimeout(() => process.exit(0), 1500);
      }, 2000);
    } else {
      await sendError(
        { message, existingMessage: confirmMsg },
        'Bot shutdown cancelled. Right decision?',
      );
    }
  });

  collector.on('end', (_collected: any, reason: string) => {
    if (reason !== 'time') return;
    confirmMsg
      .edit(buildBotActionTimedOutPayload('stop', confirmId, cancelId, activePlayers, activeRequests))
      .catch((): null => null);
  });
}
