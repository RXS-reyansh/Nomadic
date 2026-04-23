// soul/helpers/emojiResolver.ts
import type { HermacaClient } from '../structures/HermacaClient.js';

/**
 * Resolve a Discord emoji by name or ID.
 *
 * Resolution order:
 * 1. Full custom-emoji markdown  <a?:name:id>  → resolve by extracted ID
 * 2. Pure numeric string          → resolve by ID
 * 3. Name string                  → current guild → client cache → fetch every guild
 */
export async function resolveEmoji(
  client: HermacaClient,
  identifier: string,
  guild?: any,
): Promise<any | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const markdownMatch = trimmed.match(/^<a?:[\w]+:(\d+)>$/);
  if (markdownMatch) return resolveById(client, markdownMatch[1]);

  if (/^\d+$/.test(trimmed)) return resolveById(client, trimmed);

  return resolveByName(client, trimmed.toLowerCase(), guild);
}

async function resolveById(client: HermacaClient, id: string): Promise<any | null> {
  const cached = client.emojis.cache.get(id);
  if (cached) return cached;

  for (const g of client.guilds.cache.values()) {
    const fetched = await g.emojis.fetch(id).catch((): null => null);
    if (fetched) return fetched;
  }
  return null;
}

async function resolveByName(
  client: HermacaClient,
  nameLower: string,
  guild?: any,
): Promise<any | null> {
  if (guild) {
    const found = guild.emojis.cache.find((e: any) => e.name?.toLowerCase() === nameLower);
    if (found) return found;
  }

  const fromCache = client.emojis.cache.find((e: any) => e.name?.toLowerCase() === nameLower);
  if (fromCache) return fromCache;

  for (const g of client.guilds.cache.values()) {
    await g.emojis.fetch().catch(() => {});
    const found = g.emojis.cache.find((e: any) => e.name?.toLowerCase() === nameLower);
    if (found) return found;
  }
  return null;
}
