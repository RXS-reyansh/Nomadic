// soul/hermaca.ts
//
// Per-cluster bootstrap. Renders the boot block in the exact order required by
// `soul/bitchin'/startup.txt`. The console output order is fixed and important
// — each section is delimited by `logger.line()`.
//
// Order produced here (after the ASCII + [CLUSTER] block printed by the
// top-level manager in `index.ts`):
//
//   1. login → [SHARD] (per shard) → [CLIENT] block (no divider between)
//   2. [LAVALINK] + [NODE] connect
//   3. [HOST] + optional [STATUS] mobile
//   4. [DATABASE] init block
//   5. [DATABASE - LOADING DATA] cached-data block
//   6. Loader blocks: [EVENT LOADER] [HELPERS LOADER] [COMMANDS LOADER]
//                    [SLASH LOADER] [HANDLERS]
//   7. [DEVELOPER] info block
//   8. [BOT] info block
//   9. [SERVER LIST] block (validates cached invites)
//  10. [SLASH] global registration
//  11. [STATUS] applied + [YAY!] ready
//  12. [LOADING DATA - 24/7] auto-connect block (post-ready, sequential)
import { HermacaClient } from './structures/HermacaClient.js';
import logger, { setBotReady } from './console/logger.js';
import {
  getHostingServiceIP,
  getHostingProviderName,
} from './helpers/getHostingServiceIP.js';
import { ensureGuildInvite, NO_INVITE } from './helpers/inviteCache.js';
import { loadAllEvents } from './handlers/eventLoader.js';
import { loadHelpers } from './handlers/helperLoader.js';
import { loadPrefixCommands } from './handlers/commandLoader.js';
import { loadSlashCommands } from './handlers/slashLoader.js';
import { registerSlashCommands } from './handlers/commandRegister.js';
import { StatusManager } from './structures/StatusManager.js';
import config, { botName } from './config.js';
import webhookLogger from './utils/webhookLogger.js';
import { blacklistedServer } from './components/statusMessages.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { emojis } from './emojis.js';
import os from 'os';

const NODE_READY_TIMEOUT_MS = 30_000;

async function bootstrap(): Promise<HermacaClient> {
  const client = new HermacaClient();

  // ── Pre-login listeners ────────────────────────────────────────────────────
  // shardReady must be attached BEFORE login so we don't miss any events.
  // discord.js sometimes emits 'shardReady' twice for the same shard during
  // the initial connection (READY → RESUMED). Dedupe with a Set so the boot
  // block only ever shows one "Shard N ready" line per shard.
  const seenShardReady = new Set<number>();
  client.on('shardReady', (shardId: number) => {
    if (seenShardReady.has(shardId)) return;
    seenShardReady.add(shardId);
    logger.success('SHARD', `Shard ${shardId} ready`);
    webhookLogger.logShard('ready', shardId);
  });

  // Use the new 'clientReady' event (v14.x+). The legacy 'ready' alias still
  // works but emits a deprecation warning that breaks the boot-block layout.
  const readyPromise = new Promise<void>((resolve) => {
    client.once('clientReady' as any, () => resolve());
  });

  try {
    // 1. Login → SHARD lines fire as shards become ready → ready event fires
    await client.login();

    // ── Initialise Kazagumo BEFORE awaiting clientReady ──
    // Shoukaku's DiscordJS connector attaches `client.once("clientReady", ...)`
    // and only kicks off node connections inside that listener. If we
    // construct Kazagumo AFTER clientReady has already fired, the listener
    // never triggers and no Lavalink node ever connects. Build kazagumo here
    // so its listener is in place before the event fires below.
    client.initKazagumo();

    // Capture the FIRST shoukaku 'ready' so we can print the [NODE] line at
    // the right moment in the boot block. nodeConnect.ts also attaches an
    // `.on('ready')` handler, but it suppresses the boot-time log via
    // `client.bootCompleted` until after the boot block completes.
    const firstNodePromise = new Promise<string | null>((resolve) => {
      let settled = false;
      client.kazagumo.shoukaku.once('ready', (name: string) => {
        if (settled) return;
        settled = true;
        // Webhook the initial connect ourselves — the eventLoader attaches
        // nodeConnect.ts AFTER this `once` fires, so its handler would never
        // see the first ready event and the node-log webhook would silently
        // miss boot-time connections.
        webhookLogger.logNode('connect', name);
        resolve(name);
      });
      setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, NODE_READY_TIMEOUT_MS);
    });

    await readyPromise;

    // ── [CLIENT] block ── (no divider between SHARD and CLIENT)
    if (client.user) {
      logger.success('CLIENT', `Logged in as ${client.user.tag}`);
    }
    logger.info('CLIENT', `Cluster ID: ${client.cluster.id}`);

    // ── [LAVALINK] + [NODE] block ──
    logger.line();
    logger.success('LAVALINK', 'Kazagumo music system initialized');
    const nodeName = await firstNodePromise;
    if (nodeName) {
      logger.success('NODE', `✅ Lavalink node "${nodeName}" connected!`);
    } else {
      const timeoutMessage = `⏳ No Lavalink node connected within ${NODE_READY_TIMEOUT_MS / 1000}s — continuing.`;
      logger.warn('NODE', timeoutMessage);
      // Fire an error webhook so the failure is visible off-console too.
      webhookLogger.logError(
        new Error(timeoutMessage),
        'Lavalink boot-time connection timeout',
      );
    }

    // ── [HOST] + optional [STATUS] mobile ──
    logger.line();
    await getHostingServiceIP();
    if (client.usesMobileIndicator() && client.user) {
      logger.info(
        'STATUS',
        `Mobile device indicator enabled for clientId ${client.user.id}.`,
      );
    }

    // ── [DATABASE] init block (4 lines) ──
    logger.line();
    const buildName = client.matchedInstance?.buildName ?? botName;
    await client.initDatabase(buildName);

    // ── [DATABASE - LOADING DATA] cached-data block ──
    logger.line();
    await loadCachedDataBlock(client);

    // ── Loader blocks ──
    logger.line();
    await loadAllEvents(client);
    client.helpers = await loadHelpers(client);
    await loadPrefixCommands(client);
    await loadSlashCommands(client);
    logger.success('HANDLERS', 'All handlers registered');

    // ── [DEVELOPER] block ──
    logger.line();
    printDeveloperBlock();

    // ── [BOT] block ──
    logger.line();
    printBotBlock(client);

    // ── [SERVER LIST] block ──
    logger.line();
    await printServerListBlock(client);

    // ── [SLASH] global register ──
    logger.line();
    await registerSlashCommands(client);

    // ── [STATUS] applied + [YAY!] ready ──
    logger.line();
    if (client.user) {
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
    }

    // Side-effects from the legacy ready handler (silent — happens at end).
    enforceBlacklistedServers(client).catch(() => {});
    sendPendingRestartNotification(client).catch(() => {});

    logger.success('YAY!', '🎯 Bot fully initialized and ready!');
    logger.line();

    // ── [LOADING DATA - 24/7] block — actual sequential auto-connect ──
    // Runs AFTER [YAY!] because we now know whether a Lavalink node is
    // available. Output format defined in `soul/bitchin'/startup2.txt`.
    await runTwentyFourSevenReconnects(client);
    logger.line();

    // Mark the boot block fully complete: subsequent runtime-only logs
    // (lyrics, guild joins, node reconnects, etc.) are now allowed through.
    client.bootCompleted = true;
    setBotReady(true);

    webhookLogger.logReady(client);
    return client;
  } catch (error) {
    logger.error('BOOTSTRAP', `Failed to start: ${(error as Error).message}`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot-block helpers
// ─────────────────────────────────────────────────────────────────────────────

async function loadCachedDataBlock(client: HermacaClient): Promise<void> {
  // [DATABASE - LOADING DATA] ✨ Noprefix is ENABLED/DISABLED
  const noprefixEnabled = await client.db.getNoprefixGlobalEnabled().catch(() => false);
  logger.info(
    'DATABASE - LOADING DATA',
    `✨ Noprefix is ${noprefixEnabled ? 'ENABLED' : 'DISABLED'}`,
  );

  // [DATABASE - LOADING DATA] ✨ Guilds with noprefix disabled: ...
  const disabled = await client.db.getNoPrefixDisabledGuilds().catch((): any[] => []);
  if (disabled.length > 0) {
    const names = disabled
      .map((d: any): string => client.guilds.cache.get(d.guild_id)?.name ?? d.guild_id)
      .join(', ');
    logger.info('DATABASE - LOADING DATA', `✨ Guilds with noprefix disabled: ${names}`);
  } else {
    logger.info('DATABASE - LOADING DATA', `✨ Guilds with noprefix disabled: (none)`);
  }

  // [DATABASE - LOADING DATA] 🪐 AFK cache populated: N active user(s)
  const afkCount = await client.db.populateAfkCacheSilent().catch(() => 0);
  logger.info('DATABASE - LOADING DATA', `🪐 AFK cache populated: ${afkCount} active user(s)`);

  // [DATABASE - LOADING DATA] ✨ Guild volumes loaded
  await client.db.loadGuildVolumes().catch(() => new Map());
  logger.info('DATABASE - LOADING DATA', `✨ Guild volumes loaded`);

  // [DATABASE - LOADING DATA] ✨ Spotify IDs loaded   (dummy line per spec)
  logger.info('DATABASE - LOADING DATA', `✨ Spotify IDs loaded`);

  // [DATABASE - LOADING DATA] ✨ Loaded N guild prefixes
  const prefixes = await client.db.getAllGuildPrefixes().catch(() => new Map());
  logger.info('DATABASE - LOADING DATA', `✨ Loaded ${prefixes.size} guild prefixes`);

  // [DATABASE - LOADING DATA] ✨ Loaded N sticky messages
  const stickies: any[] = await client.db.getAllStickies().catch((): any[] => []);
  logger.info('DATABASE - LOADING DATA', `✨ Loaded ${stickies.length} sticky messages`);
}

/**
 * Sequentially reconnect every guild that had 24/7 enabled. Runs at the very
 * end of boot (after [YAY!]) so node connection has settled and we can log
 * the full numbered list cleanly.
 *
 * Output format (per `soul/bitchin'/startup2.txt`):
 *   [LOADING DATA - 24/7] ✨ Found N guilds with 24/7 enabled
 *   [LOADING DATA - 24/7] [1/N] Auto-connected to <vc> in <guild>
 *   ...
 *   [LOADING DATA - 24/7] ✨ 24/7 auto-connect completed
 */
async function runTwentyFourSevenReconnects(client: HermacaClient): Promise<void> {
  const raw: Array<{ guildId: string; channelId: string }> =
    (await client.db?.getAllEnabled24Seven?.().catch((): any[] => [])) ?? [];

  // Filter to only entries whose guild + voice channel still exist on this cluster.
  const valid = raw
    .map(({ guildId, channelId }) => {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return null;
      const channel: any = guild.channels.cache.get(channelId);
      if (!channel || !channel.isVoiceBased()) return null;
      return { guild, channel, guildId, channelId };
    })
    .filter((x): x is { guild: any; channel: any; guildId: string; channelId: string } => x !== null);

  logger.info(
    'LOADING DATA - 24/7',
    `✨ Found ${valid.length} guild${valid.length === 1 ? '' : 's'} with 24/7 enabled`,
  );

  if (valid.length === 0) {
    logger.info('LOADING DATA - 24/7', `✨ 24/7 auto-connect completed`);
    return;
  }

  for (let i = 0; i < valid.length; i++) {
    const { guild, channel, guildId, channelId } = valid[i];
    const idx = `[${i + 1}/${valid.length}]`;
    try {
      await client.kazagumo.createPlayer({
        guildId,
        voiceId: channelId,
        textId: guild.systemChannelId || channelId,
        deaf: true,
      });
      logger.info(
        'LOADING DATA - 24/7',
        `${idx} Auto-connected to ${channel.name} in ${guild.name}`,
      );
    } catch (err) {
      logger.error(
        'LOADING DATA - 24/7',
        `${idx} Failed to auto-connect to ${channel.name} in ${guild.name}: ${(err as Error).message}`,
      );
    }
  }

  logger.info('LOADING DATA - 24/7', `✨ 24/7 auto-connect completed`);
}

function printDeveloperBlock(): void {
  // [DEVELOPER] block — name + id of every configured developer.
  for (const [name, id] of config.developers) {
    logger.info('DEVELOPER', `🎀 ${name} — ${id}`);
  }
  logger.info('DEVELOPER', `🎀 Total developers: ${config.developers.length}`);
}

function printBotBlock(client: HermacaClient): void {
  // Cheap user count: sum guild.memberCount across the cluster's cached
  // guilds. `including bots` is the raw sum; `unique users` subtracts one
  // per guild as a rough "minus the bot itself" approximation.
  let memberSum = 0;
  let botCount = 1; // this bot
  for (const guild of client.guilds.cache.values()) {
    memberSum += guild.memberCount ?? 0;
  }
  const uniqueUsers = Math.max(0, memberSum - client.guilds.cache.size);

  const buildName = client.matchedInstance?.buildName ?? botName;
  const provider = getHostingProviderName();
  const node = `${process.version} on ${os.platform()} ${os.arch()}`;

  logger.info('BOT', `🎀 Tag: ${client.user?.tag ?? 'unknown'}`);
  logger.info('BOT', `🎀 Build: ${buildName}`);
  logger.info('BOT', `🎀 Servers: ${client.guilds.cache.size}`);
  logger.info('BOT', `🎀 Total users (incl. bots): ${memberSum}`);
  logger.info('BOT', `🎀 Approx unique users: ${uniqueUsers} (excl. ${botCount} bot)`);
  logger.info('BOT', `🎀 Runtime: ${node} • Hosted on: ${provider}`);
}

async function printServerListBlock(client: HermacaClient): Promise<void> {
  const guilds = Array.from(client.guilds.cache.values()).sort(
    (a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0),
  );

  // Format (per `soul/bitchin'/startup2.txt`):
  //   [SERVER LIST] Found N guilds
  //   [SERVER LIST] [1/N] <name> | Members: <count> |  Invite link: <url|N/A>
  logger.info(
    'SERVER LIST',
    `Found ${guilds.length} guild${guilds.length === 1 ? '' : 's'}`,
  );

  for (let i = 0; i < guilds.length; i++) {
    const guild = guilds[i];
    let inviteCode = NO_INVITE;
    try {
      inviteCode = await ensureGuildInvite(client, guild);
    } catch {
      inviteCode = NO_INVITE;
    }
    const inviteUrl =
      inviteCode === NO_INVITE ? 'N/A' : `https://discord.gg/${inviteCode}`;
    logger.info(
      'SERVER LIST',
      `[${i + 1}/${guilds.length}] ${guild.name} | Members: ${guild.memberCount ?? '?'} |  Invite link: ${inviteUrl}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Side-effects (legacy ready.ts behaviour, fired silently at end of boot)
// ─────────────────────────────────────────────────────────────────────────────

async function enforceBlacklistedServers(client: HermacaClient): Promise<void> {
  if (!client.db) return;
  const enabled = await client.db.getBlacklistServerGlobalEnabled?.();
  if (!enabled) return;
  const servers: any[] = await client.db.getBlacklistedServers?.() ?? [];
  for (const server of servers) {
    const guild = client.guilds.cache.get(server.guild_id);
    if (!guild) continue;
    const channel: any = guild.channels.cache.find((ch: any) =>
      ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages'),
    );
    if (channel) {
      await blacklistedServer({ channel }, guild, client).catch((): null => null);
    }
    await guild.leave().catch((): null => null);
  }
}

async function sendPendingRestartNotification(client: HermacaClient): Promise<void> {
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

export default await bootstrap();
