// soul/commands/utility/serverpurge.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { resolveUser } from '../../helpers/userResolver.js';
import {
  parseTextTerms,
  fetchFilteredMessages,
  deleteFetched,
} from '../../helpers/purgeHelper.js';
import {
  buildPurgeConfirmPayload,
  buildPurgeTimedOutPayload,
  buildPurgeCancelledPayload,
} from '../../components/purgeConfirm.js';

export const options = {
  name: 'serverpurge',
  aliases: [] as string[],
  description: 'Bulk-delete messages matching a filter across the entire server.',
  usage: `serverpurge text <"term1"> ["term2"] ... (up to 10 terms)
  serverpurge user <@user|ID|username> [@user2] ...
  serverpurge bot`,
  category: 'utility',
  isDeveloper: false,
  userPerms: ['ManageMessages'] as string[],
  botPerms: ['ManageMessages'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 10,
};

/** Returns all text-based, non-thread channels where the bot has ManageMessages. */
function getAccessibleChannels(guild: any): any[] {
  return guild.channels.cache
    .filter((ch: any) => {
      if (ch.isThread?.()) return false;
      if (!ch.isTextBased?.()) return false;
      const perms = ch.permissionsFor(guild.members.me);
      return perms?.has('ManageMessages') && perms?.has('ViewChannel') && perms?.has('ReadMessageHistory');
    })
    .map((ch: any) => ch);
}

async function runServerPurge(
  ctx: any,
  channels: any[],
  cmdId: string,
  cmdChannelId: string,
  filter: (msg: any) => boolean,
) {
  let totalDeleted = 0;
  let channelsTouched = 0;

  for (const ch of channels) {
    const excludeId = ch.id === cmdChannelId ? cmdId : '__none__';
    const msgs = await fetchFilteredMessages(ch, excludeId, filter, null);
    if (msgs.length === 0) continue;
    const count = await deleteFetched(msgs);
    totalDeleted += count;
    channelsTouched++;
  }

  if (totalDeleted === 0) {
    await sendInfo(ctx, 'No messages found matching your criteria across the server.');
    return;
  }

  await sendSuccess(
    ctx,
    `Successfully deleted ${totalDeleted} messages across ${channelsTouched} channel${channelsTouched !== 1 ? 's' : ''}.`,
  );
}

/** Show a server-purge confirmation prompt (prefix path), then run onConfirm on acceptance. */
async function askConfirmation(
  message: any,
  description: string,
  onConfirm: () => Promise<void>,
): Promise<void> {
  const confirmId = `serverpurge:confirm:${message.id}`;
  const cancelId = `serverpurge:cancel:${message.id}`;

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
  const confirmId = `serverpurge:confirm:${interaction.id}`;
  const cancelId = `serverpurge:cancel:${interaction.id}`;

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
  const guild = message.guild;
  const cmdId: string = message.id;
  const cmdChannelId: string = message.channel.id;

  const channels = getAccessibleChannels(guild);
  if (channels.length === 0) {
    return sendError(statusCtx, 'I do not have access to any channels in this server.');
  }

  // ── serverpurge text ──────────────────────────────────────────────────────
  if (sub === 'text') {
    const rawJoined = args.slice(1).join(' ');
    const rawQuoted = [...rawJoined.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    if (rawQuoted.length > 10) {
      return sendError(statusCtx, `Too many search terms — maximum is **10**, you provided **${rawQuoted.length}**.`);
    }

    const terms = parseTextTerms(args.slice(1));
    if (terms.length === 0) {
      return sendError(statusCtx, 'Provide at least one search term.\nExample: `serverpurge text "hello"` or `serverpurge text "hi" "hello"`');
    }
    const quoted = terms.map(t => `"${t}"`).join(', ');
    const desc = `Are you sure you want to delete **all messages containing ${quoted}** across the entire server?`;
    const lowerTerms = terms.map(t => t.toLowerCase());
    const filter = (msg: any) => lowerTerms.some(t => msg.content.toLowerCase().includes(t));
    return askConfirmation(message, desc, () =>
      runServerPurge(statusCtx, channels, cmdId, cmdChannelId, filter),
    );
  }

  // ── serverpurge user ──────────────────────────────────────────────────────
  if (sub === 'user') {
    if (args.length < 2) {
      return sendError(statusCtx, 'Provide at least one user. Example: `serverpurge user @someone @another`');
    }
    const userArgs = args.slice(1);
    const resolved = await Promise.all(userArgs.map(a => resolveUser(client, guild, a)));
    const targetUsers = resolved.filter(Boolean);
    if (targetUsers.length === 0) {
      return sendError(statusCtx, 'Could not resolve any of the provided users.');
    }
    const userIds = new Set(targetUsers.map((u: any) => u.id));
    const userList = targetUsers.map((u: any) => `**${u.username}**`).join(', ');
    const desc = `Are you sure you want to delete **all messages from ${userList}** across the entire server?`;
    const filter = (msg: any) => userIds.has(msg.author.id);
    return askConfirmation(message, desc, () =>
      runServerPurge(statusCtx, channels, cmdId, cmdChannelId, filter),
    );
  }

  // ── serverpurge bot ───────────────────────────────────────────────────────
  if (sub === 'bot') {
    const desc = 'Are you sure you want to delete **all bot messages** across the entire server?';
    const filter = (msg: any) => msg.author.bot;
    return askConfirmation(message, desc, () =>
      runServerPurge(statusCtx, channels, cmdId, cmdChannelId, filter),
    );
  }

  // ── unknown subcommand ────────────────────────────────────────────────────
  return sendError(
    statusCtx,
    `Unknown subcommand \`${args[0]}\`. Usage:\n\`\`\`\n${options.usage}\n\`\`\``,
  );
}

export async function slashExecute(interaction: any, _client: HermacaClient) {
  await interaction.deferReply();
  const ctx = { interaction };

  if (!interaction.guild) return sendError(ctx, 'This command can only be used in a server.');

  const guild = interaction.guild;
  const channels = getAccessibleChannels(guild);
  if (channels.length === 0) {
    return sendError(ctx, 'I do not have access to any channels in this server.');
  }

  const cmdChannelId: string = interaction.channelId;
  // No "command message" exists for slash, so nothing to exclude per-channel.
  const cmdId = '__none__';
  const successCtx = { interaction, asReply: false };
  const sub: string = interaction.options.getSubcommand();

  // ── /serverpurge text ─────────────────────────────────────────────────────
  if (sub === 'text') {
    const rawJoined: string = interaction.options.getString('terms', true);
    const rawQuoted = [...rawJoined.matchAll(/"([^"]+)"/g)].map(m => m[1]);
    if (rawQuoted.length > 10) {
      return sendError(ctx, `Too many search terms — maximum is **10**, you provided **${rawQuoted.length}**.`);
    }
    const terms = parseTextTerms([rawJoined]);
    if (terms.length === 0) {
      return sendError(ctx, 'Provide at least one search term.\nExample: `text "hello"` or `text "hi" "hello"`');
    }
    const quoted = terms.map(t => `"${t}"`).join(', ');
    const desc = `Are you sure you want to delete **all messages containing ${quoted}** across the entire server?`;
    const lowerTerms = terms.map(t => t.toLowerCase());
    const filter = (msg: any) => lowerTerms.some(t => msg.content.toLowerCase().includes(t));
    return askConfirmationSlash(interaction, desc, () =>
      runServerPurge(successCtx, channels, cmdId, cmdChannelId, filter),
    );
  }

  // ── /serverpurge user ─────────────────────────────────────────────────────
  if (sub === 'user') {
    const targetUser: any = interaction.options.getUser('user', true);
    const desc = `Are you sure you want to delete **all messages from ${targetUser.username}** across the entire server?`;
    const filter = (msg: any) => msg.author.id === targetUser.id;
    return askConfirmationSlash(interaction, desc, () =>
      runServerPurge(successCtx, channels, cmdId, cmdChannelId, filter),
    );
  }

  // ── /serverpurge bot ──────────────────────────────────────────────────────
  if (sub === 'bot') {
    const desc = 'Are you sure you want to delete **all bot messages** across the entire server?';
    const filter = (msg: any) => msg.author.bot;
    return askConfirmationSlash(interaction, desc, () =>
      runServerPurge(successCtx, channels, cmdId, cmdChannelId, filter),
    );
  }

  return sendError(ctx, `Unknown subcommand \`${sub}\`.`);
}
