// soul/commands/utility/purge.ts
//
// "Command message" = the user's prefix message that invoked this command
// (e.g. `$$purge 5`). Cleanup order on every successful prefix path:
//   1. Run the actual deletion
//   2. Send the success/info reply
//   3. After 3 seconds, delete the command message AND the reply together
//      (`scheduleCleanup` deletes both back-to-back).
//
// Slash path: there's no command message to delete. The deferred reply hosts
// the confirmation prompt (when applicable); on confirm we delete that reply
// and post the success/info message as a fresh channel send via `asReply: false`.
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { resolveUser } from '../../helpers/userResolver.js';
import {
  parseTextTerms,
  fetchFilteredMessages,
  deleteFetched,
  scheduleCleanup,
} from '../../helpers/purgeHelper.js';
import {
  buildPurgeConfirmPayload,
  buildPurgeTimedOutPayload,
  buildPurgeCancelledPayload,
} from '../../components/purgeConfirm.js';

export const options = {
  name: 'purge',
  aliases: [] as string[],
  description: 'Bulk-delete messages in the current channel.',
  usage: `purge all
  purge text <"term1"> ["term2"] ... (up to 10 terms)
  purge bot [amount]
  purge user <@user|ID|username> [amount]
  purge amount <n>
  purge <n>
  purge link <message-link>
  purge link <"link1"> ["link2"] ... (up to 10 links)`,
  category: 'utility',
  isDeveloper: false,
  userPerms: ['ManageMessages'] as string[],
  botPerms: ['ManageMessages'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

const CLEANUP_DELAY = 3000;
const MSG_LINK_RE =
  /^https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)\/?$/i;

/** Show a confirmation prompt (prefix path), then call onConfirm/onCancel. */
async function askConfirmation(
  message: any,
  description: string,
  onConfirm: () => Promise<void>,
): Promise<void> {
  const confirmId = `purge:confirm:${message.id}`;
  const cancelId = `purge:cancel:${message.id}`;

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

  collector.on('end', (_collected: any, reason: string) => {
    if (reason !== 'time') return;
    confirmMsg
      .edit(buildPurgeTimedOutPayload(confirmId, cancelId, description))
      .catch((): null => null);
  });
}

/** Slash-flavoured confirmation. Edits the deferred reply with the prompt. */
async function askConfirmationSlash(
  interaction: any,
  description: string,
  onConfirm: () => Promise<void>,
): Promise<void> {
  const confirmId = `purge:confirm:${interaction.id}`;
  const cancelId = `purge:cancel:${interaction.id}`;

  const confirmMsg: any = await interaction.editReply(
    buildPurgeConfirmPayload(confirmId, cancelId, description),
  );

  const collector = confirmMsg.createMessageComponentCollector({
    filter: (i: any) =>
      (i.customId === confirmId || i.customId === cancelId) &&
      i.user.id === interaction.user.id,
    max: 1,
    time: 30_000,
  });

  collector.on('collect', async (i: any) => {
    await i.deferUpdate().catch((): null => null);
    if (i.customId === confirmId) {
      await interaction.deleteReply().catch((): null => null);
      await onConfirm();
    } else {
      await interaction
        .editReply(buildPurgeCancelledPayload(confirmId, cancelId, description))
        .catch((): null => null);
      setTimeout(async () => {
        await interaction.deleteReply().catch((): null => null);
      }, 3000);
    }
  });

  collector.on('end', (_c: any, reason: string) => {
    if (reason !== 'time') return;
    interaction
      .editReply(buildPurgeTimedOutPayload(confirmId, cancelId, description))
      .catch((): null => null);
  });
}

/**
 * Run a filter-based delete in the given channel and post a success/info
 * status. `excludeId` is the command message ID for the prefix path, or
 * `'__none__'` for slash where there's no command message to skip.
 */
async function runFilteredDelete(
  ctx: any,
  channel: any,
  excludeId: string,
  filter: (msg: any) => boolean,
  maxCount: number | null,
  emptyMsg: string,
  cleanupTarget: any | null,
) {
  const msgs = await fetchFilteredMessages(channel, excludeId, filter, maxCount);
  if (msgs.length === 0) {
    const info = await sendInfo(ctx, emptyMsg);
    if (cleanupTarget) scheduleCleanup(cleanupTarget, info, CLEANUP_DELAY);
    return;
  }
  const count = await deleteFetched(msgs);
  const reply = await sendSuccess(ctx, `Successfully deleted ${count} messages.`);
  if (cleanupTarget) scheduleCleanup(cleanupTarget, reply, CLEANUP_DELAY);
}

/**
 * Resolve a list of message links to actual channels/messages, delete each,
 * then send the success/info status. Used by both prefix and slash `link` paths.
 */
async function runLinkDelete(
  ctx: any,
  client: HermacaClient,
  links: string[],
  cleanupTarget: any | null,
) {
  let deleted = 0;
  let notFound = 0;

  for (const raw of links) {
    const m = raw.trim().match(MSG_LINK_RE);
    if (!m) {
      notFound++;
      continue;
    }
    const [, gId, cId, mId] = m;
    const guild = client.guilds.cache.get(gId);
    const ch: any =
      guild?.channels?.cache?.get(cId) ??
      (await client.channels.fetch(cId).catch((): null => null));
    if (!guild || !ch || typeof ch.messages?.fetch !== 'function') {
      notFound++;
      continue;
    }
    const me = guild.members.me;
    const perms = me ? ch.permissionsFor?.(me) : null;
    if (!perms?.has?.('ManageMessages')) {
      notFound++;
      continue;
    }
    const target = await ch.messages.fetch(mId).catch((): null => null);
    if (!target) {
      notFound++;
      continue;
    }
    const ok = await target.delete().then(() => true).catch(() => false);
    if (ok) deleted++;
    else notFound++;
  }

  if (deleted === 0) {
    const info = await sendInfo(ctx, 'No messages found by the provided links.');
    if (cleanupTarget) scheduleCleanup(cleanupTarget, info, CLEANUP_DELAY);
    return;
  }

  const reply = await sendSuccess(
    ctx,
    `Successfully deleted ${deleted} message${deleted !== 1 ? 's' : ''}.`,
  );
  if (notFound > 0) {
    const info = await sendInfo(
      ctx,
      `${notFound} message${notFound !== 1 ? 's' : ''} not found by the provided link${notFound !== 1 ? 's' : ''}.`,
    );
    setTimeout(async () => {
      await (info as any)?.delete?.().catch((): null => null);
    }, CLEANUP_DELAY);
  }
  if (cleanupTarget) scheduleCleanup(cleanupTarget, reply, CLEANUP_DELAY);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const statusCtx = { message, reply: false };

  if (!message.guild) {
    return sendError(statusCtx, 'This command can only be used in a server.');
  }

  if (args.length === 0) {
    return sendError(
      statusCtx,
      `No subcommand provided. Usage:\n\`\`\`\n${options.usage}\n\`\`\``,
    );
  }

  const sub = args[0].toLowerCase();
  const channel = message.channel;
  const cmdId: string = message.id;

  // ── purge all ─────────────────────────────────────────────────────────────
  if (sub === 'all') {
    const desc = 'Are you sure you want to delete **all messages** in this channel?';
    return askConfirmation(message, desc, () =>
      runFilteredDelete(statusCtx, channel, cmdId, () => true, null, 'No messages to delete.', message),
    );
  }

  // ── purge text ────────────────────────────────────────────────────────────
  if (sub === 'text') {
    const rawJoined = args.slice(1).join(' ');
    const rawQuoted = [...rawJoined.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    if (rawQuoted.length > 10) {
      return sendError(statusCtx, `Too many search terms — maximum is **10**, you provided **${rawQuoted.length}**.`);
    }

    const terms = parseTextTerms(args.slice(1));
    if (terms.length === 0) {
      return sendError(
        statusCtx,
        'Provide at least one search term.\nExample: `purge text "hello"` or `purge text "hi" "hello"`',
      );
    }

    const quoted = terms.map(t => `"${t}"`).join(', ');
    const desc = `Are you sure you want to delete **all messages containing ${quoted}** in this channel?`;
    const lowerTerms = terms.map(t => t.toLowerCase());
    const filter = (msg: any) => lowerTerms.some(t => msg.content.toLowerCase().includes(t));

    return askConfirmation(message, desc, () =>
      runFilteredDelete(statusCtx, channel, cmdId, filter, null, 'No messages found matching your search terms.', message),
    );
  }

  // ── purge bot ─────────────────────────────────────────────────────────────
  if (sub === 'bot') {
    const amountRaw = args[1];
    const maxCount = amountRaw && /^\d+$/.test(amountRaw) ? parseInt(amountRaw, 10) : null;
    if (maxCount !== null && maxCount <= 0) {
      return sendError(statusCtx, 'Amount must be a positive number.');
    }

    const desc =
      maxCount !== null
        ? `Are you sure you want to delete **${maxCount} bot messages** in this channel?`
        : 'Are you sure you want to delete **all bot messages** in this channel?';

    return askConfirmation(message, desc, () =>
      runFilteredDelete(statusCtx, channel, cmdId, (m: any) => m.author.bot, maxCount, 'No bot messages found.', message),
    );
  }

  // ── purge user ────────────────────────────────────────────────────────────
  if (sub === 'user') {
    if (args.length < 2) {
      return sendError(
        statusCtx,
        'Provide a user. Example: `purge user @someone` or `purge user @someone 20`',
      );
    }
    const targetUser = await resolveUser(client, message.guild, args[1]);
    if (!targetUser) {
      return sendError(statusCtx, 'User not found. Try a mention, user ID, or username.');
    }
    const amountRaw = args[2];
    const maxCount = amountRaw && /^\d+$/.test(amountRaw) ? parseInt(amountRaw, 10) : null;
    if (maxCount !== null && maxCount <= 0) {
      return sendError(statusCtx, 'Amount must be a positive number.');
    }

    const desc =
      maxCount !== null
        ? `Are you sure you want to delete **${maxCount} messages from ${targetUser.username}** in this channel?`
        : `Are you sure you want to delete **all messages from ${targetUser.username}** in this channel?`;
    const filter = (msg: any) => msg.author.id === targetUser.id;

    return askConfirmation(message, desc, () =>
      runFilteredDelete(statusCtx, channel, cmdId, filter, maxCount, 'No messages found from that user.', message),
    );
  }

  // ── purge amount <n> ──────────────────────────────────────────────────────
  if (sub === 'amount') {
    const raw = args[1];
    if (!raw || !/^\d+$/.test(raw)) {
      return sendError(statusCtx, 'Provide a valid number. Example: `purge amount 10`');
    }
    const n = parseInt(raw, 10);
    if (n <= 0) return sendError(statusCtx, 'Amount must be a positive number.');

    return runFilteredDelete(statusCtx, channel, cmdId, () => true, n, 'No messages to delete.', message);
  }

  // ── purge link ────────────────────────────────────────────────────────────
  if (sub === 'link') {
    const rest = args.slice(1);
    if (rest.length === 0) {
      return sendError(
        statusCtx,
        'Provide a message link. Example: `purge link <message-link>` or `purge link "link1" "link2"`',
      );
    }

    const joined = rest.join(' ');
    const quoted = [...joined.matchAll(/"([^"]+)"/g)].map(m => m[1]);

    let links: string[];
    if (quoted.length > 0) {
      if (quoted.length > 10) {
        return sendError(
          statusCtx,
          `Too many message links — maximum is **10**, you provided **${quoted.length}**.`,
        );
      }
      links = quoted;
    } else {
      // Bare single-link form
      if (rest.length > 1) {
        return sendError(
          statusCtx,
          'For multiple links, wrap each in quotes: `purge link "link1" "link2"`',
        );
      }
      links = [rest[0]];
    }

    return runLinkDelete(statusCtx, client, links, message);
  }

  // ── purge <n> (direct number shorthand) ──────────────────────────────────
  if (/^\d+$/.test(sub)) {
    const n = parseInt(sub, 10);
    if (n <= 0) return sendError(statusCtx, 'Amount must be a positive number.');
    return runFilteredDelete(statusCtx, channel, cmdId, () => true, n, 'No messages to delete.', message);
  }

  // ── unknown subcommand ────────────────────────────────────────────────────
  return sendError(
    statusCtx,
    `Unknown subcommand \`${args[0]}\`. Usage:\n\`\`\`\n${options.usage}\n\`\`\``,
  );
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const ctx = { interaction };

  if (!interaction.guild) return sendError(ctx, 'This command can only be used in a server.');

  const channel: any = interaction.channel;
  const cmdId = '__none__';
  const successCtx = { interaction, asReply: false };
  const sub: string = interaction.options.getSubcommand();

  // ── /purge all ────────────────────────────────────────────────────────────
  if (sub === 'all') {
    const desc = 'Are you sure you want to delete **all messages** in this channel?';
    return askConfirmationSlash(interaction, desc, () =>
      runFilteredDelete(successCtx, channel, cmdId, () => true, null, 'No messages to delete.', null),
    );
  }

  // ── /purge amount ─────────────────────────────────────────────────────────
  if (sub === 'amount') {
    const n: number = interaction.options.getInteger('count', true);
    if (n <= 0) return sendError(ctx, 'Amount must be a positive number.');
    return runFilteredDelete(successCtx, channel, cmdId, () => true, n, 'No messages to delete.', null);
  }

  // ── /purge bot ────────────────────────────────────────────────────────────
  if (sub === 'bot') {
    const maxCount: number | null = interaction.options.getInteger('count');
    if (maxCount !== null && maxCount <= 0) {
      return sendError(ctx, 'Amount must be a positive number.');
    }
    const desc =
      maxCount !== null
        ? `Are you sure you want to delete **${maxCount} bot messages** in this channel?`
        : 'Are you sure you want to delete **all bot messages** in this channel?';
    return askConfirmationSlash(interaction, desc, () =>
      runFilteredDelete(successCtx, channel, cmdId, (m: any) => m.author.bot, maxCount, 'No bot messages found.', null),
    );
  }

  // ── /purge user ───────────────────────────────────────────────────────────
  if (sub === 'user') {
    const targetUser: any = interaction.options.getUser('user', true);
    const maxCount: number | null = interaction.options.getInteger('count');
    if (maxCount !== null && maxCount <= 0) {
      return sendError(ctx, 'Amount must be a positive number.');
    }
    const desc =
      maxCount !== null
        ? `Are you sure you want to delete **${maxCount} messages from ${targetUser.username}** in this channel?`
        : `Are you sure you want to delete **all messages from ${targetUser.username}** in this channel?`;
    const filter = (msg: any) => msg.author.id === targetUser.id;
    return askConfirmationSlash(interaction, desc, () =>
      runFilteredDelete(successCtx, channel, cmdId, filter, maxCount, 'No messages found from that user.', null),
    );
  }

  // ── /purge text ───────────────────────────────────────────────────────────
  if (sub === 'text') {
    const rawJoined: string = interaction.options.getString('terms', true);
    const rawQuoted = [...rawJoined.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    if (rawQuoted.length > 10) {
      return sendError(ctx, `Too many search terms — maximum is **10**, you provided **${rawQuoted.length}**.`);
    }
    const terms = parseTextTerms([rawJoined]);
    if (terms.length === 0) {
      return sendError(
        ctx,
        'Provide at least one search term.\nExample: `text "hello"` or `text "hi" "hello"`',
      );
    }
    const quoted = terms.map(t => `"${t}"`).join(', ');
    const desc = `Are you sure you want to delete **all messages containing ${quoted}** in this channel?`;
    const lowerTerms = terms.map(t => t.toLowerCase());
    const filter = (msg: any) => lowerTerms.some(t => msg.content.toLowerCase().includes(t));
    return askConfirmationSlash(interaction, desc, () =>
      runFilteredDelete(successCtx, channel, cmdId, filter, null, 'No messages found matching your search terms.', null),
    );
  }

  // ── /purge link ───────────────────────────────────────────────────────────
  if (sub === 'link') {
    const rawJoined: string = interaction.options.getString('links', true).trim();
    const quoted = [...rawJoined.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    let links: string[];
    if (quoted.length > 0) {
      if (quoted.length > 10) {
        return sendError(ctx, `Too many message links — maximum is **10**, you provided **${quoted.length}**.`);
      }
      links = quoted;
    } else {
      // No quotes: must be a single bare link with no spaces
      if (/\s/.test(rawJoined)) {
        return sendError(ctx, 'For multiple links, wrap each in quotes: `"link1" "link2"`');
      }
      if (!rawJoined) return sendError(ctx, 'Provide at least one message link.');
      links = [rawJoined];
    }
    return runLinkDelete(successCtx, client, links, null);
  }

  return sendError(ctx, `Unknown subcommand \`${sub}\`.`);
}
