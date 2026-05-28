import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';
import { blacklistedServer } from '../../components/statusMessages.js';
import { sendWelcome } from '../../components/welcome.js';
import { botName } from '../../config.js';
import { ensureGuildInvite } from '../../helpers/inviteCache.js';

export const name = 'guildCreate';
export const type = 'discord';

export async function execute(_client: any, guild: any): Promise<void> {
  logger.success('GUILD', `Joined guild: ${guild.name} (${guild.id})`);

  if (
    await _client.db?.getBlacklistServerGlobalEnabled() &&
    await _client.db?.isServerBlacklisted(guild.id)
  ) {
    // Self-healing — if this guild is owned by a developer, drop the stale
    // blacklist entry instead of kicking the bot back out. Mirrors the
    // dev-bypass logic in messageCreate / interactionCreate.
    const developerIds: string[] = _client.config.developers.map((dev: string[]) => dev[1]);
    if (developerIds.includes(guild.ownerId)) {
      await _client.db.removeBlacklistedServer(guild.id).catch((): null => null);
      // Fall through to normal guild registration / welcome below.
    } else {
      const channel = guild.channels.cache.find((ch: any) =>
        ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages')
      );
      if (channel) await blacklistedServer({ channel }, guild, _client).catch((): null => null);
      await guild.leave().catch((): null => null);
      return;
    }
  }

  // Register guild in database
  if (_client.db?.registerGuild) {
    await _client.db.registerGuild(guild.id).catch(() => {});
  }

  // Cache an invite code for the new guild (used by the [SERVER LIST] block
  // and `/invite-guild`). Silently falls back to "N/A" downstream if the bot
  // lacks `CreateInstantInvite` perms.
  ensureGuildInvite(_client, guild).catch(() => {});

  // Send welcome message if possible
  const channel = guild.channels.cache.find((ch: any) =>
    ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages')
  );
  if (channel) {
    await sendWelcome({
      channel,
      guild,
      botName,
      prefix: _client.config?.prefix ?? '$$',
    });
  }

  webhookLogger.logGuildJoin(guild);
}
