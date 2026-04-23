import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { resolveUser } from '../../helpers/userResolver.js';
import { buildNoprefixListPayload } from '../../components/noprefixList.js';
import { escapeMarkdown } from '../../utils/formatting.js';

export const options = {
  name: 'noprefix',
  aliases: ['nop'] as string[],
  description: 'Manage no-prefix access. (Developer only)',
  usage: `noprefix add <user id | mention | username>
  noprefix remove <user id | mention | username>
  noprefix list
  noprefix enable
  noprefix disable
  noprefix server enable [server id]
  noprefix server disable [server id]
  noprefix server list`,
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 0,
};

async function resolveTargetUserId(message: any, args: string[], client: HermacaClient): Promise<string | null> {
  const rawTarget = args.slice(1).join(' ').trim();
  if (!rawTarget) return null;
  const user = await resolveUser(client, message.guild, rawTarget);
  return user?.id ?? null;
}

function resolveGuildId(message: any, maybeGuildId?: string): string | null {
  if (!maybeGuildId) return message.guild?.id ?? null;
  return /^\d{17,20}$/.test(maybeGuildId) ? maybeGuildId : null;
}

function formatGuild(client: HermacaClient, guildId: string): string {
  const guild = client.guilds.cache.get(guildId);
  if (guild) return `${escapeMarkdown(guild.name)} (${guildId})`;
  return guildId;
}

async function handleList(message: any, client: HermacaClient) {
  const users = await client.db.getNoPrefixUsers();
  const lines = await Promise.all(users.map(async (entry: any) => {
    const user = await client.users.fetch(entry.user_id).catch((): null => null);
    return user ? `${user.tag} (${entry.user_id})` : entry.user_id;
  }));
  await message.channel.send(
    buildNoprefixListPayload(
      'Noprefix Users list',
      lines,
      'Total users',
      'No users have noprefix access (except the developers).',
    ) as any,
  );
}

async function handleServerList(message: any, client: HermacaClient) {
  const guilds = await client.db.getNoPrefixDisabledGuilds();
  const lines = guilds.map((entry: any) => {
    const guild = client.guilds.cache.get(entry.guild_id);
    return guild ? `${escapeMarkdown(guild.name)} (${entry.guild_id})` : entry.guild_id;
  });
  await message.channel.send(
    buildNoprefixListPayload(
      'Noprefix Disabled Servers list',
      lines,
      'Total disabled servers',
      "Noprefix hasn't been disabled in any servers.",
    ) as any,
  );
}

async function handleServer(message: any, args: string[], client: HermacaClient) {
  const action = args[1]?.toLowerCase();
  if (action === 'list') return handleServerList(message, client);

  if (!['enable', 'disable'].includes(action)) {
    return sendWrongUsage({ message, client }, options.name, options.usage);
  }

  const guildId = resolveGuildId(message, args[2]);
  if (!guildId) return sendError({ message }, 'Please provide a valid server ID.');

  const label = formatGuild(client, guildId);
  const isCurrentlyDisabled = await client.db.isGuildNoPrefixDisabled(guildId);

  if (action === 'enable') {
    if (!isCurrentlyDisabled) {
      return sendInfo({ message }, `Noprefix is already enabled in server **${label}**.`);
    }
    await client.db.enableGuildNoPrefix(guildId);
    return sendSuccess({ message }, `Noprefix has been enabled in server **${label}**.`);
  }

  if (isCurrentlyDisabled) {
    return sendInfo({ message }, `Noprefix is already disabled in server **${label}**.`);
  }
  await client.db.disableGuildNoPrefix(guildId, message.author.id);
  return sendSuccess({ message }, `Noprefix has been disabled in server **${label}**.`);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (args.length === 0) return sendWrongUsage({ message, client }, options.name, options.usage);

  const action = args[0]?.toLowerCase();

  if (action === 'add') {
    const userId = await resolveTargetUserId(message, args, client);
    if (!userId) return sendError({ message }, 'Please provide a valid user ID, mention, or username.');
    const alreadyAdded = await client.db.isNoPrefixUser(userId);
    if (alreadyAdded) return sendInfo({ message }, `<@${userId}> already has noprefix access.`);
    await client.db.addNoPrefixUser(userId, message.author.id);
    return sendSuccess({ message }, `Noprefix access has been added for <@${userId}>.`);
  }

  if (action === 'remove') {
    const userId = await resolveTargetUserId(message, args, client);
    if (!userId) return sendError({ message }, 'Please provide a valid user ID, mention, or username.');
    const removed = await client.db.removeNoPrefixUser(userId);
    if (!removed) return sendError({ message }, `<@${userId}> is not in the noprefix list.`);
    return sendSuccess({ message }, `Noprefix access has been removed from <@${userId}>.`);
  }

  if (action === 'list') return handleList(message, client);

  if (action === 'enable') {
    const alreadyEnabled = await client.db.getNoprefixGlobalEnabled();
    if (alreadyEnabled) return sendInfo({ message }, 'Noprefix is already globally enabled.');
    await client.db.setNoprefixGlobalEnabled(true);
    return sendSuccess({ message }, 'Noprefix has been globally enabled.');
  }

  if (action === 'disable') {
    const alreadyEnabled = await client.db.getNoprefixGlobalEnabled();
    if (!alreadyEnabled) return sendInfo({ message }, 'Noprefix is already globally disabled.');
    await client.db.setNoprefixGlobalEnabled(false);
    return sendSuccess({ message }, 'Noprefix has been globally disabled.');
  }

  if (action === 'server') return handleServer(message, args, client);

  return sendWrongUsage({ message, client }, options.name, options.usage);
}
