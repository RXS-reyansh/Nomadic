// soul/commands/utility/purge-till.ts
//
// $$purge-till <message_id_or_link> [n]
//
// Looks up the target message in the current channel (by ID or link), then
// asks for confirmation to delete the messages sent AFTER it.
//   • If `n` is provided → deletes the n OLDEST messages after the target
//     (i.e. the next n replies that came right after it).
//   • If `n` is omitted → deletes ALL messages after the target.
//
// The command message itself is always excluded from deletion.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { deleteFetched, scheduleCleanup } from '../../helpers/purgeHelper.js';
import {
  buildPurgeConfirmPayload,
  buildPurgeTimedOutPayload,
  buildPurgeCancelledPayload,
} from '../../components/purgeConfirm.js';

export const options = {
  name: 'purge-till',
  aliases: ['purgetill', 'pt'] as string[],
  description: 'Delete messages in this channel that were sent after a target message.',
  usage: `purge-till <message-id-or-link>
  purge-till <message-id-or-link> <n>`,
  category: 'utility',
  isDeveloper: false,
  userPerms: ['Administrator'] as string[],
  botPerms: ['ManageMessages'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

const CLEANUP_DELAY = 3000;
const MSG_LINK_RE =
  /^https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)\/?$/i;

function parseTarget(token: string, currentChannelId: string): { messageId: string; sameChannel: boolean } | null {
  const trimmed = token.trim();
  if (/^\d{17,20}$/.test(trimmed)) return { messageId: trimmed, sameChannel: true };
  const m = trimmed.match(MSG_LINK_RE);
  if (!m) return null;
  const [, , cId, mId] = m;
  return { messageId: mId, sameChannel: cId === currentChannelId };
}

async function askConfirmation(
  message: any,
  description: string,
  onConfirm: () => Promise<void>,
): Promise<void> {
  const confirmId = `pt:confirm:${message.id}`;
  const cancelId = `pt:cancel:${message.id}`;

  const confirmMsg = await message.channel.send(
    buildPurgeConfirmPayload(confirmId, cancelId, description),
  );

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
      await confirmMsg.delete().catch((): null => null);
      await onConfirm();
    } else {
      await confirmMsg
        .edit(buildPurgeCancelledPayload(confirmId, cancelId, description))
        .catch((): null => null);
      setTimeout(async () => {
        await confirmMsg.delete().catch((): null => null);
        await message.delete().catch((): null => null);
      }, 3000);
    }
  });

  collector.on('end', (_c: any, reason: string) => {
    if (reason !== 'time') return;
    confirmMsg
      .edit(buildPurgeTimedOutPayload(confirmId, cancelId, description))
      .catch((): null => null);
  });
}

/**
 * Walk the channel forward from `afterId` and return up to `maxCount` messages
 * (oldest-first). When `maxCount` is null, returns ALL messages after the target.
 * The command message itself is always excluded.
 */
async function fetchMessagesAfter(
  channel: any,
  afterId: string,
  excludeId: string,
  maxCount: number | null,
): Promise<any[]> {
  const collected: any[] = [];
  let after = afterId;

  while (true) {
    const batch = await channel.messages
      .fetch({ limit: 100, after })
      .catch((): null => null);
    if (!batch || batch.size === 0) break;

    // Discord returns `after` results newest-first within the batch; we want
    // oldest-first overall so we can take the FIRST n chronologically.
    const sorted = [...batch.values()].sort(
      (a: any, b: any) => a.createdTimestamp - b.createdTimestamp,
    );
    for (const m of sorted) {
      if (m.id === excludeId) continue;
      collected.push(m);
    }
    // The next page must start AFTER the newest message of this batch.
    const newestId = sorted[sorted.length - 1]?.id;
    if (!newestId || batch.size < 100) break;
    after = newestId;

    if (maxCount !== null && collected.length >= maxCount) break;
  }

  return maxCount !== null ? collected.slice(0, maxCount) : collected;
}

export async function prefixExecute(message: any, args: string[], _client: HermacaClient) {
  const ctx = { message, reply: false };

  if (!message.guild) return sendError(ctx, 'This command can only be used in a server.');

  let targetId: string | null = null;
  let amountArg: string | undefined;

  if (args.length === 0) {
    // No-args reply form: use the replied-to message as the target.
    const refId: string | undefined = message.reference?.messageId;
    if (!refId) {
      return sendError(
        ctx,
        `No target provided. Either reply to a message and run \`purge-till\`, or:\n\`\`\`\n${options.usage}\n\`\`\``,
      );
    }
    targetId = refId;
  } else {
    const parsed = parseTarget(args[0], message.channel.id);
    if (!parsed) {
      return sendError(ctx, 'Invalid target. Provide a message ID or a Discord message link.');
    }
    if (!parsed.sameChannel) {
      return sendError(ctx, 'The target message link must point to **this** channel.');
    }
    targetId = parsed.messageId;
    amountArg = args[1];
  }

  let maxCount: number | null = null;
  if (amountArg !== undefined) {
    if (!/^\d+$/.test(amountArg)) return sendError(ctx, 'Amount must be a positive number.');
    const n = parseInt(amountArg, 10);
    if (n <= 0) return sendError(ctx, 'Amount must be a positive number.');
    maxCount = n;
  }

  // Verify the target exists in this channel before asking for confirmation.
  const target = await message.channel.messages
    .fetch(targetId)
    .catch((): null => null);
  if (!target) return sendError(ctx, 'Target message not found in this channel.');

  const desc =
    maxCount !== null
      ? `Are you sure you want to delete the **next ${maxCount} messages after** [this message](${target.url})?`
      : `Are you sure you want to delete **all messages after** [this message](${target.url})?`;

  return askConfirmation(message, desc, async () => {
    const msgs = await fetchMessagesAfter(message.channel, targetId!, message.id, maxCount);
    if (msgs.length === 0) {
      const info = await sendInfo(ctx, 'No messages to delete after the target.');
      scheduleCleanup(message, info, CLEANUP_DELAY);
      return;
    }
    const count = await deleteFetched(msgs);
    const reply = await sendSuccess(ctx, `Successfully deleted ${count} message${count !== 1 ? 's' : ''}.`);
    scheduleCleanup(message, reply, CLEANUP_DELAY);
  });
}
