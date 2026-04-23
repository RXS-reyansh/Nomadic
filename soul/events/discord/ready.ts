import logger, { setBotReady } from '../../console/logger.js';
import { registerSlashCommands } from '../../handlers/commandRegister.js';
import webhookLogger from '../../utils/webhookLogger.js';
import { blacklistedServer } from '../../components/statusMessages.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { emojis } from '../../emojis.js';
import { StatusManager } from '../../structures/StatusManager.js';

export const name = 'ready';
export const type = 'discord';
export const once = true;

export async function execute(client: any): Promise<void> {
  if (!client.user) return;

  // Kazagumo + Shoukaku do not require an explicit init() call with the user ID —
  // the DiscordJS connector handles everything automatically.
  logger.success('CLIENT', `Logged in as ${client.user.tag}`);
  logger.info('CLIENT', `Cluster ID: ${client.cluster.id}`);
  logger.info('CLIENT', `Guilds: ${client.guilds.cache.size}`);

  setBotReady(true);

  // ── Status / presence ──
  // Driven by `soul/config/botInstances.ts`. The initial presence is already
  // installed at IDENTIFY-time by HermacaClient (so the status pill shows
  // up the moment the bot connects), but here we also start any rotation
  // timers (multi-status / multi-presence / multi-displayStatus).
  client.statusManager = new StatusManager(client, client.user.id);
  if (client.statusManager.hasMatchedInstance()) {
    client.statusManager.start();
  } else if (client.config.defaultPresence) {
    client.user.setPresence({
      activities: [{
        name: client.config.defaultPresence.name,
        type: client.config.defaultPresence.type as any,
      }],
      status: client.config.defaultPresence.status as any,
    });
  }

  await enforceBlacklistedServers(client);
  await sendPendingRestartNotification(client);

  // Register slash commands globally
  await registerSlashCommands(client);

  // Auto-connect 24/7 if enabled
  await reconnect24Seven(client);

  webhookLogger.logReady(client);
}

async function sendPendingRestartNotification(client: any) {
  if (!client.db?.getPendingRestartChannel) return;
  try {
    const pending = await client.db.getPendingRestartChannel();
    if (!pending) return;
    await client.db.clearPendingRestartChannel().catch((): null => null);

    const devId: string | undefined = client.config?.developers?.[0]?.[1];
    const mentionText = devId ? `<@${devId}>` : 'Developer';

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.blacktick} ${mentionText} Restarted the bot successfully by respawning clusters.`,
      ),
    );

    const payload: any = {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: devId ? { users: [devId] } : { parse: [] },
    };

    let channel: any = null;
    if (pending.guildId) {
      const guild = client.guilds.cache.get(pending.guildId);
      channel = guild?.channels?.cache?.get(pending.channelId) ?? null;
    }
    if (!channel) {
      channel = await client.channels.fetch(pending.channelId).catch((): null => null);
    }
    if (channel?.send) {
      await channel.send(payload).catch((): null => null);
    }
  } catch {
    // Non-fatal — ignore errors in restart notification
  }
}

function getSendableChannel(guild: any) {
  return guild?.channels?.cache?.find((ch: any) =>
    ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages')
  ) ?? null;
}

async function enforceBlacklistedServers(client: any) {
  if (!client.db) return;
  const enabled = await client.db.getBlacklistServerGlobalEnabled();
  if (!enabled) return;
  const servers = await client.db.getBlacklistedServers();
  for (const server of servers) {
    const guild = client.guilds.cache.get(server.guild_id);
    if (!guild) continue;
    const channel = getSendableChannel(guild);
    if (channel) await blacklistedServer({ channel }, guild, client).catch((): null => null);
    await guild.leave().catch((): null => null);
  }
}

async function reconnect24Seven(client: any) {
  if (!client.db) return;
  try {
    const entries = await client.db.getAllEnabled24Seven();
    for (const { guildId, channelId } of entries) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isVoiceBased()) continue;

      setTimeout(async () => {
        try {
          await client.kazagumo.createPlayer({
            guildId,
            voiceId: channelId,
            textId: guild.systemChannelId || channelId,
            deaf: true,
          });
          logger.success('24-7', `Auto-connected to ${guild.name} / ${channel.name}`);
        } catch (err) {
          logger.error('24-7', `Auto-connect failed for ${guild.name}: ${(err as Error).message}`);
        }
      }, 2000);
    }
  } catch (err) {
    logger.error('24-7', `Failed to load 24/7 data: ${(err as Error).message}`);
  }
}
