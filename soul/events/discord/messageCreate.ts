import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';
import { validate } from '../../handlers/commandValidator.js';
import { blacklistedUser, sendError, sendInfo } from '../../components/statusMessages.js';
import { buildAfkNoticePayload, buildAfkRemovedPayload, formatHumanDuration } from '../../components/afk.js';
import { updateSticky } from '../../helpers/stickyHelper.js';

export const name = 'messageCreate';
export const type = 'discord';

export async function execute(client: any, message: any): Promise<void> {
  if (!message.guild) return;

  // Sticky-message refresh runs for every guild message including bot
  // messages — the helper itself uses an in-memory + DB loop guard so it
  // ignores the bot's own sticky posts.
  await updateSticky(client, message).catch((): null => null);

  if (message.author.bot) return;

  const owners = client.config.developers.map((dev: string[]) => dev[1]);

  if (client.db) {
    const removedAfks = client.db.isUserAFK(message.author.id)
      ? await client.db.removeActiveAFKForMessage(message.author.id, message.guildId)
      : [];
    if (removedAfks.length) {
      const earliest = removedAfks.reduce((oldest: any, current: any) =>
        new Date(current.since_at).getTime() < new Date(oldest.since_at).getTime() ? current : oldest,
      );
      await message.reply(buildAfkRemovedPayload(
        formatHumanDuration(Date.now() - new Date(earliest.since_at).getTime()),
        new Date(),
      )).catch((): null => null);
    }

    const afkTargets = new Map<string, any>();
    for (const [id, user] of message.mentions.users) {
      if (id !== message.author.id) afkTargets.set(id, user);
    }

    if (message.reference?.messageId) {
      const replied = await message.channel.messages.fetch(message.reference.messageId).catch((): null => null);
      if (replied?.author && !replied.author.bot && replied.author.id !== message.author.id) {
        afkTargets.set(replied.author.id, replied.author);
      }
    }

    for (const [userId, user] of afkTargets) {
      if (!client.db.isUserAFK(userId)) continue;
      const afk = await client.db.getAFK(userId, message.guildId);
      if (afk) {
        const member = await message.guild.members.fetch(userId).catch((): null => null);
        await message.reply(buildAfkNoticePayload({
          displayName: member?.displayName ?? user.username,
          sinceAt: new Date(afk.since_at),
          tillAt: afk.till_at ? new Date(afk.till_at) : null,
          reason: afk.reason,
          imageUrl: afk.image_url,
          mentionedBy: message.author.username,
          mentionedAt: new Date(),
        })).catch((): null => null);
      }
    }
  }

  // Determine prefix
  let prefix = client.config.prefix;
  let isNativePrefix = false;
  if (client.helpers?.getGuildPrefix) {
    const guildPrefix = await client.helpers.getGuildPrefix(message.guildId);
    if (guildPrefix) {
      prefix = guildPrefix;
      isNativePrefix = true;
    }
  }

  // Check for prefix or no-prefix
  let content = message.content;
  let usedPrefix = false;
  let usedPrefixType: 'Native' | 'Global' | 'NoPrefix' = isNativePrefix ? 'Native' : 'Global';

  // Bot-mention prefix: only triggers when the very first token is the bot
  // mention (`<@id>` or `<@!id>`). Anywhere else in the message → ignored.
  let viaMention = false;
  const botId = client.user?.id;
  if (botId) {
    const mentionRe = new RegExp(`^<@!?${botId}>`);
    const mentionMatch = content.match(mentionRe);
    if (mentionMatch) {
      const rest = content.slice(mentionMatch[0].length).trim();
      if (!rest) {
        // Mention only, nothing else → tell them the prefix and stop.
        await sendInfo(
          { message },
          `Prefix in this server is "${prefix}". Use ${prefix}help to see all commands.`,
        ).catch((): null => null);
        return;
      }
      content = rest;
      usedPrefix = true;
      viaMention = true;
    }
  }

  if (!usedPrefix && content.startsWith(prefix)) {
    content = content.slice(prefix.length).trim();
    usedPrefix = true;
  } else if (!usedPrefix) {
    const firstWord = content.split(/\s+/)[0].toLowerCase();
    const isKnownCommand = client.commands.has(firstWord) || client.aliases.has(firstWord);
    const isDeveloper = owners.includes(message.author.id);
    const globalEnabled = isDeveloper || await client.db?.getNoprefixGlobalEnabled();
    const guildAllowed = isDeveloper || !(await client.db?.isGuildNoPrefixDisabled(message.guildId));
    const userAllowed = isDeveloper || await client.db?.isNoPrefixUser(message.author.id);
    if (isKnownCommand && globalEnabled && guildAllowed && userAllowed) {
      usedPrefix = true;
      usedPrefixType = 'NoPrefix';
    }
  }

  if (!usedPrefix) return;

  const args = content.split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;
  message.commandRawArgs = content.slice(commandName.length).trim();

  let command = client.commands.get(commandName);
  if (!command) {
    const alias = client.aliases.get(commandName);
    if (alias) command = client.commands.get(alias);
  }
  if (!command) {
    // When invoked via @mention, an unknown command should be reported.
    // For regular prefix usage we stay silent (matches existing behaviour).
    if (viaMention) {
      await sendError(
        { message },
        `Command not found. Use ${prefix}help to see all commands.`,
      ).catch((): null => null);
    }
    return;
  }

  if (
    await client.db?.getBlacklistGlobalEnabled() &&
    await client.db?.isUserBlacklisted(message.author.id)
  ) {
    await blacklistedUser({ message }).catch((): null => null);
    return;
  }

  // Validate permissions, developer-only status, cooldowns, etc.
  const passed = await validate(
    command.options,
    {
      userId: message.author.id,
      guildId: message.guild.id,
      voiceChannelId: message.member?.voice?.channelId ?? undefined,
    },
    { message },
    client,
  );
  if (!passed) return;

  try {
    await command.prefixExecute(message, args, client);
    webhookLogger.logCommand(
      commandName,
      message.author,
      message.guild,
      args,
      { prefix: usedPrefixType === 'NoPrefix' ? 'none' : prefix, type: usedPrefixType },
    );
    if (client.db?.incrementGlobalCommandsExecuted) {
      client.db.incrementGlobalCommandsExecuted().catch((): null => null);
    }
  } catch (err) {
    logger.error('COMMAND', `Error in ${commandName}: ${(err as Error).message}`);
    message.reply('❌ An error occurred while executing the command.').catch((): null => null);
  }
}
