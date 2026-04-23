import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { resolveUser } from '../../helpers/userResolver.js';
import { buildBlacklistListPayload } from '../../components/blacklistList.js';

export const options = {
  name: 'blacklist',
  aliases: ['bl'] as string[],
  description: 'Manage blacklisted users. (Developer only)',
  usage: `blacklist add <user id | mention | username>
  blacklist remove <user id | mention | username>
  blacklist list
  blacklist enable
  blacklist disable`,
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

async function handleList(message: any, client: HermacaClient) {
  const users = await client.db.getBlacklistedUsers();
  const lines = await Promise.all(users.map(async (entry: any) => {
    const user = await client.users.fetch(entry.user_id).catch((): null => null);
    return user ? `${user.tag} (${entry.user_id})` : entry.user_id;
  }));
  await message.channel.send(
    buildBlacklistListPayload(
      'Blacklist Users list',
      lines,
      'Total users',
      'No users are blacklisted.',
    ) as any,
  );
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const action = args[0]?.toLowerCase();
  if (!action) return sendWrongUsage({ message, client }, options.name, options.usage);

  if (action === 'add') {
    const userId = await resolveTargetUserId(message, args, client);
    if (!userId) return sendError({ message }, 'Please provide a valid user ID, mention, or username.');
    const alreadyBlacklisted = await client.db.isUserBlacklisted(userId);
    if (alreadyBlacklisted) return sendInfo({ message }, `<@${userId}> is already blacklisted.`);
    await client.db.addBlacklistedUser(userId, message.author.id);
    return sendSuccess({ message }, `<@${userId}> has been added to the blacklist.`);
  }

  if (action === 'remove') {
    const userId = await resolveTargetUserId(message, args, client);
    if (!userId) return sendError({ message }, 'Please provide a valid user ID, mention, or username.');
    const removed = await client.db.removeBlacklistedUser(userId);
    if (!removed) return sendError({ message }, `<@${userId}> is not in the blacklist.`);
    return sendSuccess({ message }, `<@${userId}> has been removed from the blacklist.`);
  }

  if (action === 'list') return handleList(message, client);

  if (action === 'enable') {
    const alreadyEnabled = await client.db.getBlacklistGlobalEnabled();
    if (alreadyEnabled) return sendInfo({ message }, 'Blacklist is already globally enabled.');
    await client.db.setBlacklistGlobalEnabled(true);
    return sendSuccess({ message }, 'Blacklist has been globally enabled.');
  }

  if (action === 'disable') {
    const alreadyEnabled = await client.db.getBlacklistGlobalEnabled();
    if (!alreadyEnabled) return sendInfo({ message }, 'Blacklist is already globally disabled.');
    await client.db.setBlacklistGlobalEnabled(false);
    return sendSuccess({ message }, 'Blacklist has been globally disabled.');
  }

  return sendWrongUsage({ message, client }, options.name, options.usage);
}
