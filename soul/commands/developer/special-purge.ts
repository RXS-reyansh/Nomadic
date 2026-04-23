// soul/commands/developer/special-purge.ts
//
// Dev-only "alternating" purge. Given an even number of integers (2..20),
// the command walks the channel from the most recent message backwards and
// alternately *leaves* the next N messages, then *deletes* the next M
// messages, then leaves, then deletes... in order of the supplied args.
//
// Example: `special-purge 2 5 1 3` leaves the 2 most recent, deletes the
// next 5, leaves the next 1, deletes the next 3.
//
// The command (invocation) message is itself excluded from the walk.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { deleteFetched, scheduleCleanup } from '../../helpers/purgeHelper.js';

const CLEANUP_DELAY = 3000;

export const options = {
  name: 'special-purge',
  aliases: ['sp'] as string[],
  description: 'Alternating leave/delete purge. Developer-only.',
  usage: 'special-purge <leaveN> <deleteN> [leaveN deleteN ...]  (even count, 2-20)',
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: ['ManageMessages'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

async function fetchChannelMessages(channel: any, excludeId: string, needed: number): Promise<any[]> {
  // Discord's bulkDelete max-batch is 100 and we walk backwards from the most
  // recent message. Loop until we've gathered `needed` non-excluded messages
  // or the channel runs out.
  const out: any[] = [];
  let before: string | undefined;
  while (out.length < needed) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch((): any => null);
    if (!batch || batch.size === 0) break;
    for (const [, m] of batch) {
      if (m.id === excludeId) continue;
      out.push(m);
      if (out.length >= needed) break;
    }
    before = batch.last()?.id;
    if (!before) break;
  }
  return out;
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };

  if (!message.guild) return sendError(ctx, 'This command can only be used in a server.');

  if (args.length === 0) {
    return sendError(ctx, `Provide alternating leave/delete counts.\nUsage: \`${options.usage}\``);
  }
  if (args.length % 2 !== 0) {
    return sendError(ctx, 'You must provide an **even** number of values (leave/delete pairs).');
  }
  if (args.length < 2 || args.length > 20) {
    return sendError(ctx, 'Provide between **2 and 20** values total.');
  }

  const nums: number[] = [];
  for (const a of args) {
    if (!/^\d+$/.test(a)) return sendError(ctx, `Invalid value \`${a}\` — all values must be non-negative integers.`);
    nums.push(parseInt(a, 10));
  }

  const totalNeeded = nums.reduce((s, n) => s + n, 0);
  if (totalNeeded === 0) return sendError(ctx, 'Nothing to do — all values are zero.');

  const messages = await fetchChannelMessages(message.channel, message.id, totalNeeded);

  // Walk through pairs: [leave, delete, leave, delete, ...]
  const toDelete: any[] = [];
  let leftCount = 0;
  let cursor = 0;
  for (let i = 0; i < nums.length; i += 2) {
    const leaveN = nums[i];
    const deleteN = nums[i + 1];
    // Leave (skip)
    const leaveSlice = messages.slice(cursor, cursor + leaveN);
    leftCount += leaveSlice.length;
    cursor += leaveN;
    // Delete
    const delSlice = messages.slice(cursor, cursor + deleteN);
    toDelete.push(...delSlice);
    cursor += deleteN;
    if (cursor >= messages.length) break;
  }

  if (toDelete.length === 0) {
    const info = await sendSuccess(ctx, `Left ${leftCount} messages. Deleted 0 messages.`);
    scheduleCleanup(message, info, CLEANUP_DELAY);
    return;
  }

  const deleted = await deleteFetched(toDelete);
  const reply = await sendSuccess(
    ctx,
    `Left ${leftCount} messages. Successfully deleted ${deleted} message${deleted !== 1 ? 's' : ''}.`,
  );
  scheduleCleanup(message, reply, CLEANUP_DELAY);
}
