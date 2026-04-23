// soul/utils/webhookLogger.ts
//
// WEBHOOK LOGGER EMOJIS
// ---------------------
// Webhooks cannot access emojis from other servers or Application Emojis.
// Define the emojis below using markdown from the SAME server the webhook
// channels live in. Replace the empty strings with the correct emoji markdown
// (e.g. '<a:myEmoji:1234567890>') and they will render in embed titles.
//
const logEmojis = {
  blackTick:   '<a:blackTick:1495731642965299200>',   // shown in: Bot Ready, Bot Joined Guild
  redCross:    '<a:redCross:1495732843983278081>',   // shown in: Bot Left Guild, Error Occurred
  info:        '<a:info:1495732893321007187>',   // shown in: Command Executed
  blackCross:  '<a:black_cross:1493821051459866644>',   // shown in: Shard events
  flowersBlue: '<:flowersBlue:1495730942814322770>',   // shown in: Node events
  melodyDance:   '<a:MelodyDance:1495730991401009265>',   // shown in: Track Started
};

import { WebhookClient, EmbedBuilder } from 'discord.js';
import logger from '../console/logger.js';
import config from '../config.js';

interface QueuedMessage {
  webhookKey: keyof typeof config.webhooks;
  embed: EmbedBuilder;
}

interface PrefixInfo {
  prefix: string;
  type: 'Native' | 'Global' | 'Slash' | 'NoPrefix';
}

function withEmoji(emoji: string, text: string): string {
  return emoji ? `${emoji} ${text}` : text;
}

class WebhookLogger {
  private static instance: WebhookLogger;
  private webhooks: Map<string, WebhookClient> = new Map();
  private queue: QueuedMessage[] = [];
  private processing = false;
  private readonly RATE_LIMIT_MS = 200;

  private constructor() {
    this.init();
  }

  static getInstance(): WebhookLogger {
    if (!WebhookLogger.instance) {
      WebhookLogger.instance = new WebhookLogger();
    }
    return WebhookLogger.instance;
  }

  private init(): void {
    for (const [key, url] of Object.entries(config.webhooks)) {
      if (url && typeof url === 'string') {
        try {
          this.webhooks.set(key, new WebhookClient({ url }));
          logger.debug('WEBHOOK', `Loaded ${key} webhook`);
        } catch (err) {
          logger.error('WEBHOOK', `Failed to load ${key}: ${(err as Error).message}`);
        }
      }
    }

    setInterval(() => this.processQueue(), this.RATE_LIMIT_MS);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const item = this.queue.shift();
    if (item) {
      const webhook = this.webhooks.get(item.webhookKey);
      if (webhook) {
        try {
          await webhook.send({ embeds: [item.embed] });
        } catch (err) {
          logger.error('WEBHOOK', `Webhook send failed (${item.webhookKey}): ${(err as Error).message}`);
        }
      }
    }

    this.processing = false;
  }

  private enqueue(key: keyof typeof config.webhooks, embed: EmbedBuilder): void {
    if (!this.webhooks.has(key)) return;
    this.queue.push({ webhookKey: key, embed });
    if (this.queue.length > 30) {
      logger.warn('WEBHOOK', `Queue has ${this.queue.length} pending messages`);
    }
  }

  // ------------------------- PUBLIC METHODS -------------------------

  logReady(client: any): void {
    const presenceName: string =
      client.statusManager?.getInstanceName?.() ?? 'N/A';
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(withEmoji(logEmojis.blackTick, 'Bot Ready'))
      .setDescription(
        `**User:** ${client.user?.tag || 'N/A'}\n` +
        `**Guilds:** ${client.guilds.cache.size}\n` +
        `**Cluster:** ${client.cluster?.id?.toString() || 'N/A'}\n` +
        `**Presence:** ${presenceName}`,
      )
      .setTimestamp();
    this.enqueue('readyLog', embed);
  }

  logGuildJoin(guild: any): void {
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(withEmoji(logEmojis.blackTick, 'Bot Joined Guild'))
      .setDescription(
        `**Name:** ${guild.name}\n` +
        `**ID:** ${guild.id}\n` +
        `**Members:** ${guild.memberCount?.toString() || 'N/A'}\n` +
        `**Owner:** <@${guild.ownerId}>\n` +
        `**Shard:** ${guild.shardId?.toString() || 'N/A'}`,
      )
      .setThumbnail(guild.iconURL() || null)
      .setTimestamp();

    logger.info('GUILD', `Joined ${guild.name} (${guild.id})`);
    this.enqueue('joinLeave', embed);
  }

  logGuildLeave(guild: any): void {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(withEmoji(logEmojis.redCross, 'Bot Left Guild'))
      .setDescription(
        `**Name:** ${guild.name}\n` +
        `**ID:** ${guild.id}\n` +
        `**Members:** ${guild.memberCount?.toString() || 'N/A'}\n` +
        `**Owner:** <@${guild.ownerId}>\n` +
        `**Shard:** ${guild.shardId?.toString() || 'N/A'}`,
      )
      .setThumbnail(guild.iconURL() || null)
      .setTimestamp();

    logger.info('GUILD', `Left ${guild.name} (${guild.id})`);
    this.enqueue('joinLeave', embed);
  }

  logCommand(
    commandName: string,
    user: any,
    guild: any | null,
    args: string[],
    prefixInfo?: PrefixInfo,
  ): void {
    const guildLine = guild ? `${guild.name} (${guild.id})` : 'DM';
    const prefixLine = prefixInfo
      ? `\n**Prefix:** \`${prefixInfo.prefix}\` (${prefixInfo.type})`
      : '';

    const embed = new EmbedBuilder()
      .setColor(parseInt(config.embedColor.replace('#', ''), 16))
      .setTitle(withEmoji(logEmojis.info, 'Command Executed'))
      .setDescription(
        `**Command:** ${commandName}\n` +
        `**User:** ${user.tag} (${user.id})\n` +
        `**Guild:** ${guildLine}` +
        prefixLine +
        `\n**Args:** ${args.length ? args.join(' ') : 'None'}`,
      )
      .setTimestamp();

    logger.debug('COMMAND', `${commandName} by ${user.tag}`);
    this.enqueue('commandLog', embed);
  }

  logShard(event: string, shardId: number, error?: Error): void {
    const isError = event === 'error';
    const desc = [
      `**Shard ID:** ${shardId}`,
      `**Event:** ${event}`,
      ...(error ? [
        `**Error:** ${error.message}`,
        `**Stack:**\n\`\`\`${error.stack?.slice(0, 900) || 'N/A'}\`\`\``,
      ] : []),
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor(isError ? 0xe74c3c : 0x3498db)
      .setTitle(withEmoji(logEmojis.blackCross, `Shard ${event.charAt(0).toUpperCase() + event.slice(1)}`))
      .setDescription(desc)
      .setTimestamp();

    logger.info('SHARD', `Shard ${shardId} ${event}${error ? ` - ${error.message}` : ''}`);
    this.enqueue('shardLog', embed);
  }

  logNode(event: string, nodeName: string, error?: Error): void {
    const isError = event === 'error';
    const desc = [
      `**Node:** ${nodeName}`,
      `**Event:** ${event}`,
      ...(error ? [
        `**Error:** ${error.message}`,
        `**Stack:**\n\`\`\`${error.stack?.slice(0, 900) || 'N/A'}\`\`\``,
      ] : []),
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor(isError ? 0xe74c3c : 0x9b59b6)
      .setTitle(withEmoji(logEmojis.flowersBlue, `Node ${event.charAt(0).toUpperCase() + event.slice(1)}`))
      .setDescription(desc)
      .setTimestamp();

    logger.info('NODE', `Node ${nodeName} ${event}${error ? ` - ${error.message}` : ''}`);
    this.enqueue('nodeLog', embed);
  }

  logTrackStart(guild: any, track: any): void {
    // Kazagumo tracks are flat — no .info wrapper
    const requester = track.requester;
    const requesterTag = (requester as any)?.tag || (requester as any)?.username || 'Unknown';
    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setTitle(withEmoji(logEmojis.melodyDance, 'Track Started'))
      .setDescription(
        `**Guild:** ${guild.name} (${guild.id})\n` +
        `**Track:** ${track.title}\n` +
        `**Artist:** ${track.author}\n` +
        `**Requester:** ${requesterTag}`,
      )
      .setThumbnail(track.thumbnail || null)
      .setTimestamp();
    this.enqueue('trackLog', embed);
  }

  logError(error: Error, context?: string): void {
    const desc = [
      `**Message:** ${error.message}`,
      `**Stack:**\n\`\`\`${error.stack?.slice(0, 900) || 'N/A'}\`\`\``,
      ...(context ? [`**Context:** ${context}`] : []),
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(withEmoji(logEmojis.redCross, 'Error Occurred'))
      .setDescription(desc)
      .setTimestamp();

    logger.error('ERROR', `${context ? `[${context}] ` : ''}${error.message}`);
    this.enqueue('errorLog', embed);
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

export default WebhookLogger.getInstance();
