import { HermacaClient } from '../../structures/HermacaClient.js';
import { blacklistedServer, sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { buildBlacklistListPayload } from '../../components/blacklistList.js';
import { escapeFormatting, escapeMarkdown } from '../../utils/formatting.js';

export const options = {
  name: 'blacklist-server',
  aliases: ['bl-server', 'bl-srv'] as string[],
  description: 'Manage blacklisted servers. (Developer only)',
  usage: `blacklist-server
  blacklist-server add <server id>
  blacklist-server remove <server id>
  blacklist-server list
  blacklist-server enable
  blacklist-server disable`,
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 0,
};

function resolveGuildId(message: any, maybeGuildId?: string): string | null {
  if (!maybeGuildId) return message.guild?.id ?? null;
  return /^\d{17,20}$/.test(maybeGuildId) ? maybeGuildId : null;
}

function formatGuild(client: HermacaClient, guildId: string): string {
  const guild = client.guilds.cache.get(guildId);
  if (guild) return `${escapeMarkdown(guild.name)} (${guildId})`;
  return guildId;
}

function getSendableChannel(guild: any) {
  return guild?.channels?.cache?.find((ch: any) =>
    ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages')
  ) ?? null;
}

async function notifyAndLeaveGuild(client: HermacaClient, guildId: string) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const channel = getSendableChannel(guild);
  if (channel) await blacklistedServer({ channel }, guild, client).catch((): null => null);
  await guild.leave().catch((): null => null);
}

async function handleList(message: any, client: HermacaClient) {
  const servers = await client.db.getBlacklistedServers();
  const lines = servers.map((entry: any) => {
    const guild = client.guilds.cache.get(entry.guild_id);
    return guild ? `${escapeMarkdown(guild.name)} (${entry.guild_id})` : entry.guild_id;
  });

  const devId: string | undefined = (client.config as any)?.developers?.[0]?.[1];
  let footerNote: string | undefined;
  if (devId) {
    const devUser = await client.users.fetch(devId).catch((): null => null);
    if (devUser) footerNote = `Owner: @${escapeFormatting(devUser.username)}`;
  }

  await message.channel.send(
    buildBlacklistListPayload(
      'Blacklist Servers list',
      lines,
      'Total servers',
      'No servers are blacklisted.',
      footerNote,
    ) as any,
  );
}

/**
 * Returns true if the given guild is owned by any of the bot's developers.
 * Used as the dev-protection check for `blacklist-server` — blacklisting a
 * dev-owned guild causes the bot to leave it the moment global enforcement
 * runs, which is almost always an accident.
 */
async function isDeveloperOwnedGuild(client: HermacaClient, guildId: string): Promise<boolean> {
  const developerIds: string[] = client.config.developers.map((dev: string[]) => dev[1]);
  const cached = client.guilds.cache.get(guildId);
  if (cached) return developerIds.includes(cached.ownerId);

  // Fall back to a REST lookup for guilds the bot isn't currently in. This
  // lets `blacklist-server add <id>` reject dev-owned guilds even when the
  // bot has never joined them.
  const fetched: any = await client.guilds.fetch(guildId).catch((): null => null);
  if (!fetched) return false;
  const ownerId: string | undefined = fetched.ownerId ?? fetched.owner_id;
  return ownerId ? developerIds.includes(ownerId) : false;
}

async function addServer(message: any, guildId: string, client: HermacaClient) {
  // Hard guard — never blacklist a guild owned by a developer. Without this
  // a dev can blacklist their own server (or the support server) and the bot
  // immediately leaves it under global enforcement.
  if (await isDeveloperOwnedGuild(client, guildId)) {
    const label = formatGuild(client, guildId);
    return sendError(
      { message },
      `Server **${label}** is owned by a developer and cannot be blacklisted.`,
    );
  }

  const alreadyBlacklisted = await client.db.isServerBlacklisted(guildId);
  if (alreadyBlacklisted) {
    const label = formatGuild(client, guildId);
    return sendInfo({ message }, `Server **${label}** is already blacklisted.`);
  }
  await client.db.addBlacklistedServer(guildId, message.author.id);
  const label = formatGuild(client, guildId);
  await sendSuccess({ message }, `Server **${label}** has been added to the blacklist.`);
  if (await client.db.getBlacklistServerGlobalEnabled()) {
    await notifyAndLeaveGuild(client, guildId);
  }
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const action = args[0]?.toLowerCase();

  if (!action) {
    const guildId = resolveGuildId(message);
    if (!guildId) return sendError({ message }, 'This command must be used in a server.');
    return addServer(message, guildId, client);
  }

  if (action === 'add') {
    const guildId = resolveGuildId(message, args[1]);
    if (!guildId) return sendError({ message }, 'Please provide a valid server ID.');
    return addServer(message, guildId, client);
  }

  if (action === 'remove') {
    const guildId = resolveGuildId(message, args[1]);
    if (!guildId) return sendError({ message }, 'Please provide a valid server ID.');
    const removed = await client.db.removeBlacklistedServer(guildId);
    if (!removed) return sendError({ message }, `Server \`${guildId}\` is not in the blacklist.`);
    const label = formatGuild(client, guildId);
    return sendSuccess({ message }, `Server **${label}** has been removed from the blacklist.`);
  }

  if (action === 'list') return handleList(message, client);

  if (action === 'enable') {
    const alreadyEnabled = await client.db.getBlacklistServerGlobalEnabled();
    if (alreadyEnabled) return sendInfo({ message }, 'Server blacklist is already globally enabled.');
    await client.db.setBlacklistServerGlobalEnabled(true);
    const servers = await client.db.getBlacklistedServers();
    let cleaned = 0;
    for (const server of servers) {
      // Self-healing: if a dev-owned guild slipped into the blacklist before
      // the dev-guard existed, silently drop it instead of kicking the bot
      // out of the dev's own server the moment enforcement turns on.
      if (await isDeveloperOwnedGuild(client, server.guild_id)) {
        await client.db.removeBlacklistedServer(server.guild_id).catch((): null => null);
        cleaned++;
        continue;
      }
      await notifyAndLeaveGuild(client, server.guild_id);
    }
    const tail = cleaned ? ` (${cleaned} developer-owned ${cleaned === 1 ? 'server was' : 'servers were'} auto-removed.)` : '';
    return sendSuccess({ message }, `Server blacklist has been globally enabled.${tail}`);
  }

  if (action === 'disable') {
    const alreadyEnabled = await client.db.getBlacklistServerGlobalEnabled();
    if (!alreadyEnabled) return sendInfo({ message }, 'Server blacklist is already globally disabled.');
    await client.db.setBlacklistServerGlobalEnabled(false);
    return sendSuccess({ message }, 'Server blacklist has been globally disabled.');
  }

  return sendWrongUsage({ message, client }, options.name, options.usage);
}
