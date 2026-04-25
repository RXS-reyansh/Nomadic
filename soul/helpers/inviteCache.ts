// soul/helpers/inviteCache.ts
//
// Per-guild invite-code cache. Stored in MongoDB collection `guild_invites`.
// Used by:
//   • Boot-block [SERVER LIST] rendering (validates each cached code, recreates
//     invalid ones, falls back to "N/A" if the bot lacks `CreateInstantInvite`).
//   • `guildCreate` event — caches an invite the moment the bot joins a server.
//   • `/invite-guild` admin tool (returns the cached code).
import type { Guild } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';

export const NO_INVITE = 'N/A';

/**
 * Return a usable invite code for `guild`. Strategy:
 *   1. If `guild_invites` already has a code, fetch its current invite list
 *      and verify the code is still valid. Reuse if so.
 *   2. Otherwise (or if invalid) try to create a new invite on the first
 *      text channel where the bot has `CreateInstantInvite`.
 *   3. If no permitted channel exists, return `NO_INVITE` ("N/A") and clear
 *      the stale cache entry.
 *
 * The result is upserted into the cache so subsequent boots are O(1).
 */
export async function ensureGuildInvite(client: any, guild: Guild): Promise<string> {
  const cached: string | null = await client.db?.getGuildInvite(guild.id).catch((): null => null);

  // Step 1: validate the cached code (if any) by fetching live invites.
  if (cached) {
    try {
      const invites = await guild.invites.fetch();
      if (invites.has(cached)) return cached;
    } catch {
      // fall through to recreate
    }
  }

  // Step 2: create a new invite on the first text channel the bot can use.
  const me = guild.members.me;
  if (!me) {
    if (cached) await client.db?.removeGuildInvite(guild.id).catch(() => {});
    return NO_INVITE;
  }

  const channel = guild.channels.cache.find((ch: any): boolean => {
    if (ch.type !== 0 && ch.type !== 5) return false; // text or announcement
    const perms = ch.permissionsFor?.(me);
    return perms?.has(PermissionFlagsBits.CreateInstantInvite);
  });

  if (!channel) {
    if (cached) await client.db?.removeGuildInvite(guild.id).catch(() => {});
    return NO_INVITE;
  }

  try {
    const invite = await (channel as any).createInvite({
      maxAge: 0,
      maxUses: 0,
      unique: false,
      reason: 'Auto-cached invite for boot SERVER LIST / /invite-guild',
    });
    await client.db?.setGuildInvite(guild.id, invite.code).catch(() => {});
    return invite.code;
  } catch {
    if (cached) await client.db?.removeGuildInvite(guild.id).catch(() => {});
    return NO_INVITE;
  }
}
