// soul/helpers/userResolver.ts
//
// Resolve a Discord User from a raw argument string.
// Accepted formats (in order of precedence):
//   1. User mention      <@123456789>  or  <@!123456789>
//   2. Numeric snowflake ID             123456789012345678
//   3. Username / display name          (searches guild members)
//
// Returns the discord.js User object, or null if nothing was found.

import type { HermacaClient } from '../structures/HermacaClient.js';

export async function resolveUser(
  client: HermacaClient,
  guild: any,
  arg: string,
): Promise<any | null> {
  const trimmed = arg.trim();
  if (!trimmed) return null;

  // 1. Mention
  const mentionMatch = trimmed.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return client.users.fetch(mentionMatch[1]).catch((): null => null);
  }

  // 2. Snowflake ID (17-20 digits)
  if (/^\d{17,20}$/.test(trimmed)) {
    return client.users.fetch(trimmed).catch((): null => null);
  }

  // 3. Username / display name — search guild members
  if (guild) {
    const lowerArg = trimmed.toLowerCase();
    const members = await guild.members
      .fetch({ query: trimmed, limit: 10 })
      .catch(() => new Map());

    for (const [, m] of members) {
      if (
        m.user.username.toLowerCase() === lowerArg ||
        m.displayName?.toLowerCase() === lowerArg
      ) {
        return m.user;
      }
    }
  }

  return null;
}
