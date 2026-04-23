import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';
import { blacklistedServer } from '../../components/statusMessages.js';
import { botName } from '../../config.js';

export const name = 'guildCreate';
export const type = 'discord';

export async function execute(_client: any, guild: any): Promise<void> {
  logger.success('GUILD', `Joined guild: ${guild.name} (${guild.id})`);

  if (
    await _client.db?.getBlacklistServerGlobalEnabled() &&
    await _client.db?.isServerBlacklisted(guild.id)
  ) {
    const channel = guild.channels.cache.find((ch: any) =>
      ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages')
    );
    if (channel) await blacklistedServer({ channel }, guild, _client).catch((): null => null);
    await guild.leave().catch((): null => null);
    return;
  }

  // Register guild in database
  if (_client.db?.registerGuild) {
    await _client.db.registerGuild(guild.id).catch(() => {});
  }

  // Send welcome message if possible
  const channel = guild.channels.cache.find((ch: any) =>
    ch.type === 0 && ch.permissionsFor(guild.members.me)?.has('SendMessages')
  );
  if (channel) {
    await channel.send(`👋 **Thanks for inviting ${botName}!** Use \`$$help\` to get started.`).catch(() => {});
  }

  webhookLogger.logGuildJoin(guild);
}
