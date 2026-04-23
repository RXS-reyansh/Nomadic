// soul/helpers/purgeHelper.ts
// Shared utilities for purge and serverpurge commands.

/**
 * Parse text search terms from args after the subcommand token.
 * Quoted terms ("hello world") are extracted individually.
 * If no quotes are present, the entire remaining string is treated as one term.
 * Maximum 10 terms returned.
 */
export function parseTextTerms(args: string[]): string[] {
  if (args.length === 0) return [];
  const joined = args.join(' ');
  const quoted = [...joined.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  if (quoted.length > 0) return quoted.slice(0, 10);
  const trimmed = joined.trim();
  return trimmed ? [trimmed] : [];
}

/**
 * Fetch messages from a channel that pass the given filter.
 * Paginates until all matching messages are collected (or maxCount is reached).
 * Always excludes the command message (excludeId).
 */
export async function fetchFilteredMessages(
  channel: any,
  excludeId: string,
  filter: (msg: any) => boolean,
  maxCount: number | null,
): Promise<any[]> {
  const result: any[] = [];
  let lastId: string | undefined;

  while (true) {
    const opts: any = { limit: 100 };
    if (lastId) opts.before = lastId;

    const batch = await channel.messages.fetch(opts).catch((): null => null);
    if (!batch || batch.size === 0) break;

    for (const [, msg] of batch) {
      if (msg.id === excludeId) continue;
      if (!filter(msg)) continue;
      result.push(msg);
      if (maxCount !== null && result.length >= maxCount) return result;
    }

    lastId = batch.last()?.id;
    if (!lastId || batch.size < 100) break;
  }

  return result;
}

/**
 * Delete an array of messages.
 * Uses bulk delete (up to 100 at a time) for messages < 14 days old.
 * Falls back to individual delete for older messages.
 * Returns the count of messages that were attempted (errors are swallowed).
 */
export async function deleteFetched(messages: any[]): Promise<number> {
  if (messages.length === 0) return 0;

  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - TWO_WEEKS_MS;

  const recent = messages.filter(m => m.createdTimestamp > cutoff);
  const old = messages.filter(m => m.createdTimestamp <= cutoff);

  let deleted = 0;

  for (let i = 0; i < recent.length; i += 100) {
    const chunk = recent.slice(i, i + 100);
    if (chunk.length === 1) {
      const ok = await chunk[0].delete().then(() => true).catch(() => false);
      if (ok) deleted++;
      continue;
    }
    // Try bulkDelete first. If it fails (e.g. one of the messages turned out
    // to be older than 14d, or is a system/pinned message Discord refuses to
    // bulk-delete), fall back to individual deletes so the rest of the batch
    // still goes through. This was the "special-purge missed 2 messages"
    // root cause: a bulk failure used to silently drop the whole chunk.
    const bulkOk = await chunk[0].channel.bulkDelete(chunk, false)
      .then(() => true)
      .catch(() => false);
    if (bulkOk) {
      deleted += chunk.length;
    } else {
      for (const m of chunk) {
        const ok = await m.delete().then(() => true).catch(() => false);
        if (ok) deleted++;
      }
    }
  }

  for (const msg of old) {
    const ok = await msg.delete().then(() => true).catch(() => false);
    if (ok) deleted++;
  }

  return deleted;
}

/**
 * Schedule deletion of two messages after a delay (default 5 seconds).
 */
export function scheduleCleanup(msgA: any, msgB: any, delayMs = 5000): void {
  setTimeout(async () => {
    await msgA?.delete().catch((): null => null);
    await msgB?.delete().catch((): null => null);
  }, delayMs);
}

/**
 * Schedule deletion of a single message after a delay (default 5 seconds).
 */
export function scheduleSingleCleanup(msg: any, delayMs = 5000): void {
  setTimeout(async () => {
    await msg?.delete().catch((): null => null);
  }, delayMs);
}
