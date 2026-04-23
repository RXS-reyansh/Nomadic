// soul/helpers/stickyHelper.ts
//
// Sticky-message engine.
//
// Strategy (slightly improved over the reference):
//   • One sticky per (guild, channel). Stored in `sticky_messages` collection.
//   • Cache `client.stickyMessages` maps `${gId}-${cId}` → most-recently-sent
//     bot sticky message ID. Used as a cheap loop-guard so the sticky we just
//     posted does not retrigger another post.
//   • `updatingLocks` Set guards against re-entrancy when many messages arrive
//     in quick succession in the same channel.
//   • Each call queries the DB for the *current* sticky config so disable/set
//     changes apply immediately without needing a cache invalidation event.
//   • For 'cv2' and 'embed' types the JSON is sent verbatim — the user is the
//     one validating their own JSON. For 'text' the payload is sent as plain
//     content so Discord native markdown formatting Just Works.
//
// Caller flow:
//   messageCreate.ts → updateSticky(client, message)
//   sticky set       → setStickyAndPost(...)  (used by the sticky command)

import { MessageFlags } from 'discord.js';

const updatingLocks = new Set<string>();

export type StickyType = 'text' | 'cv2' | 'embed';

/**
 * Build the discord.js send-payload for a sticky based on its type.
 * Caller must catch JSON.parse errors before invoking with cv2/embed.
 */
export function buildStickyPayload(type: StickyType, payload: string): any {
  if (type === 'text') {
    return { content: payload, allowedMentions: { parse: [] } };
  }
  if (type === 'cv2') {
    const components = JSON.parse(payload);
    return {
      components: Array.isArray(components) ? components : [components],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }
  // embed
  const parsed = JSON.parse(payload);
  // Accept either a full message-style object ({ content, embeds, ... })
  // or just the embeds array, or a single embed object.
  if (Array.isArray(parsed)) {
    return { embeds: parsed, allowedMentions: { parse: [] } };
  }
  if (parsed && typeof parsed === 'object' && 'embeds' in parsed) {
    return {
      content: parsed.content ?? null,
      embeds: parsed.embeds ?? [],
      allowedMentions: { parse: [] },
    };
  }
  return { embeds: [parsed], allowedMentions: { parse: [] } };
}

/**
 * Send the sticky into a channel and update DB + cache with the new ID.
 * Returns the sent message (or null on failure).
 */
export async function postStickyToChannel(
  client: any,
  channel: any,
  guildId: string,
  channelId: string,
  type: StickyType,
  payload: string,
): Promise<any | null> {
  const sendPayload = buildStickyPayload(type, payload);
  const sent = await channel.send(sendPayload).catch((): null => null);
  if (!sent) return null;

  const key = `${guildId}-${channelId}`;
  client.stickyMessages.set(key, sent.id);
  await client.db.setStickyLastMessageId(guildId, channelId, sent.id).catch((): null => null);
  return sent;
}

/**
 * Set or replace the sticky for a channel and immediately post it.
 * Used by the `sticky set ...` command.
 */
export async function setStickyAndPost(
  client: any,
  channel: any,
  guildId: string,
  channelId: string,
  type: StickyType,
  payload: string,
): Promise<any | null> {
  // Remove any existing sticky message first so the new one lands cleanly.
  const key = `${guildId}-${channelId}`;
  const prevId = client.stickyMessages.get(key);
  if (prevId) {
    const prev = await channel.messages.fetch(prevId).catch((): null => null);
    if (prev) await prev.delete().catch((): null => null);
    client.stickyMessages.delete(key);
  }

  // Persist (this also marks enabled=true).
  await client.db.setSticky(guildId, channelId, type, payload, null);

  // Post and update last_message_id.
  return postStickyToChannel(client, channel, guildId, channelId, type, payload);
}

/**
 * Called from messageCreate for every guild message. Re-posts the sticky at
 * the bottom of the channel if there is one configured + enabled, unless the
 * incoming message IS the bot's own most recent sticky (loop guard).
 */
export async function updateSticky(client: any, message: any): Promise<void> {
  if (!message?.guild) return;

  const guildId = message.guild.id;
  const channelId = message.channel.id;
  const key = `${guildId}-${channelId}`;

  // Loop guard: only skip the bot's own message when its ID matches the
  // most-recently-sent sticky (cache OR persisted last_message_id). This
  // way other bot-authored messages (e.g. /say replies, success notices)
  // DO trigger a sticky re-post — fixing the "sticky doesn't repost after
  // the bot's own non-sticky message" bug.
  const cachedLast = client.stickyMessages.get(key);
  if (cachedLast && cachedLast === message.id) return;

  if (message.author?.id === client.user?.id) {
    // It's a bot message, but not the cached sticky — fall through to the
    // DB-backed check below (which compares against last_message_id).
  }

  if (updatingLocks.has(key)) return;
  updatingLocks.add(key);

  try {
    const data = await client.db.getSticky(guildId, channelId);
    if (!data || !data.enabled || !data.payload) return;

    // Loop-guard #2 (DB-backed): handles the very first message after a
    // restart, before the in-memory cache is hot.
    if (data.last_message_id && data.last_message_id === message.id) {
      client.stickyMessages.set(key, data.last_message_id);
      return;
    }

    // Delete the prior sticky if we know about it.
    const prevId = client.stickyMessages.get(key) ?? data.last_message_id;
    if (prevId) {
      const prev = await message.channel.messages.fetch(prevId).catch((): null => null);
      if (prev) await prev.delete().catch((): null => null);
    }

    await postStickyToChannel(
      client,
      message.channel,
      guildId,
      channelId,
      data.type as StickyType,
      data.payload,
    );
  } catch {
    /* swallow */
  } finally {
    // Small debounce window — coalesces rapid bursts.
    setTimeout(() => updatingLocks.delete(key), 200);
  }
}
