import { HermacaClient } from '../../structures/HermacaClient.js';
import { blacklistedServer, sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { buildBlacklistListPayload } from '../../components/blacklistList.js';
import { escapeMarkdown } from '../../utils/formatting.js';

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
    if (devUser) footerNote = `Owner: @${devUser.username}`;
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

async function addServer(message: any, guildId: string, client: HermacaClient) {
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
    for (const server of servers) {
      await notifyAndLeaveGuild(client, server.guild_id);
    }
    return sendSuccess({ message }, 'Server blacklist has been globally enabled.');
  }

  if (action === 'disable') {
    const alreadyEnabled = await client.db.getBlacklistServerGlobalEnabled();
    if (!alreadyEnabled) return sendInfo({ message }, 'Server blacklist is already globally disabled.');
    await client.db.setBlacklistServerGlobalEnabled(false);
    return sendSuccess({ message }, 'Server blacklist has been globally disabled.');
  }

  return sendWrongUsage({ message, client }, options.name, options.usage);
}
