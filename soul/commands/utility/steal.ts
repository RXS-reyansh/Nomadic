// soul/commands/utility/steal.ts
//
// Steals ANY custom emoji or sticker and adds it to the server.
//
// Usage:
//   $$steal <:emoji1:id> [<a:emoji2:id>] …   — steal emojis typed in message
//   $$steal                                   — reply to any message with custom
//                                               emojis / stickers to steal them
//
// - Emojis are gathered from BOTH the steal command's own content AND the
//   replied-to message's content, then deduplicated by ID.
// - Stickers are collected from the replied-to message.
// - Emojis already present in this guild (matched by ID) are skipped.
// - Lottie stickers (Discord's proprietary animated format) cannot be stolen
//   by any bot and are reported with a clear explanation.

import type { HermacaClient } from '../../structures/HermacaClient.js';
import {
  sendError,
  sendInfo,
  sendLoading,
  sendSuccess,
  type StatusContext,
} from '../../components/statusMessages.js';
import {
  extractCustomEmojis,
  stealEmoji,
  stealSticker,
} from '../../helpers/stealHelper.js';

export const options = {
  name: 'steal',
  aliases: ['se', 'stealemoji', 'stealsticker'] as string[],
  description: 'Steal any custom emoji or sticker and add it to this server.',
  usage: `steal <emoji(s)>
  steal  (reply to a message containing custom emojis or a sticker)`,
  category: 'utility',
  isDeveloper: false,
  userPerms: ['ManageGuildExpressions'] as string[],
  botPerms: ['ManageGuildExpressions'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

export async function prefixExecute(message: any, _args: string[], _client: HermacaClient) {
  const ctx: StatusContext = { message };
  const guild = message.guild;

  if (!guild) return sendError(ctx, 'This command can only be used in a server.');

  // ── Fetch referenced message (if replying) ───────────────────────────────
  let refMessage: any = null;
  if (message.reference?.messageId) {
    refMessage = await message.fetchReference().catch((): null => null);
  }

  const ownContent: string = message.content ?? '';
  const refContent: string = refMessage?.content ?? '';
  const refStickers: any[] = refMessage ? [...(refMessage.stickers?.values() ?? [])] : [];

  // ── Collect candidate emojis from both messages ──────────────────────────
  const allEmojis = extractCustomEmojis(ownContent, refContent);

  // Skip emojis that are already in this guild (matched by source emoji ID is
  // not possible since added emojis get a new ID — so we never skip here;
  // the guild may legitimately want a second copy or a renamed version).
  // We DO skip the guild's OWN emojis to avoid pointless self-copies.
  const ownEmojiIds = new Set<string>(guild.emojis.cache.map((e: any) => e.id));
  const emojisToSteal = allEmojis.filter(e => !ownEmojiIds.has(e.id));

  const hasEmojis = emojisToSteal.length > 0;
  const hasStickers = refStickers.length > 0;

  // ── Nothing to steal ────────────────────────────────────────────────────
  if (!hasEmojis && !hasStickers) {
    // They had valid custom emojis but they all belong to this server already
    if (allEmojis.length > 0) {
      return sendInfo(ctx, 'All of those emojis already belong to this server.');
    }
    return sendError(
      ctx,
      'No custom emojis or stickers found.\n' +
      '-# Type custom emojis in your message, or reply to a message containing them / a sticker.',
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  const totalItems = emojisToSteal.length + refStickers.length;
  const loadingMsg = await sendLoading(
    ctx,
    `Stealing ${totalItems} item${totalItems !== 1 ? 's' : ''}…`,
  );

  // Prepare a context that edits the loading message for the first output,
  // then falls through to new replies for subsequent messages.
  const resultCtx: StatusContext = {
    message,
    existingMessage: loadingMsg as any,
  };

  // ── Steal emojis (parallel — they are independent) ──────────────────────
  const emojiResults = hasEmojis
    ? await Promise.all(emojisToSteal.map(e => stealEmoji(guild, e)))
    : [];

  const emojiOk = emojiResults.filter(r => r.success);
  const emojiErr = emojiResults.filter(r => !r.success);

  // ── Steal stickers (sequential — avoid sticker API rate-limits) ──────────
  const stickerResults: any[] = [];
  for (const sticker of refStickers) {
    stickerResults.push(await stealSticker(guild, sticker));
  }

  const stickerOk = stickerResults.filter(r => r.success);
  const stickerLottie = stickerResults.filter(r => r.lottie);
  const stickerErr = stickerResults.filter(r => !r.success && !r.lottie);

  // Helper: use loadingMsg as existingMessage once, then send new replies
  async function report(fn: (c: StatusContext, msg: string) => Promise<any>, text: string) {
    await fn(resultCtx, text);
    resultCtx.existingMessage = undefined; // subsequent calls send new replies
  }

  // ── Emoji successes ──────────────────────────────────────────────────────
  if (emojiOk.length > 0) {
    // Render the newly created guild emojis so the user can see them
    const rendered = emojiOk.map(r => {
      const e = r.created;
      if (!e) return `\`${r.parsed.name}\``;
      return e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
    });

    const count = emojiOk.length;
    if (count === 1) {
      await report(sendSuccess, `Stolen emoji **${emojiOk[0].parsed.name}**: ${rendered[0]}`);
    } else {
      await report(sendSuccess, `Stolen **${count}** emojis: ${rendered.join(' ')}`);
    }
  }

  // ── Sticker successes ────────────────────────────────────────────────────
  for (const r of stickerOk) {
    await report(sendSuccess, `Stolen sticker **${r.created?.name ?? r.sticker.name}**!`);
  }

  // ── Emoji failures ───────────────────────────────────────────────────────
  if (emojiErr.length > 0) {
    const names = emojiErr.map(r => `\`${r.parsed.name}\``).join(', ');
    const reason = emojiErr[0].error ?? 'Unknown error';
    await report(
      sendError,
      `Failed to steal ${emojiErr.length === 1 ? 'emoji' : 'emojis'} ${names}.\n-# ${reason}`,
    );
  }

  // ── Sticker failures (non-Lottie) ────────────────────────────────────────
  for (const r of stickerErr) {
    await report(
      sendError,
      `Failed to steal sticker **${r.sticker.name}**: ${r.error ?? 'Unknown error'}`,
    );
  }

  // ── Lottie notice ────────────────────────────────────────────────────────
  // Reported as info rather than error — it's a Discord limitation, not a bug.
  if (stickerLottie.length > 0) {
    const names = stickerLottie.map((r: any) => `**${r.sticker.name}**`).join(', ');
    const plural = stickerLottie.length > 1;
    await report(
      sendInfo,
      `${names} ${plural ? 'are' : 'is a'} Lottie sticker${plural ? 's' : ''} — ` +
      `these use Discord's proprietary animation format and cannot be stolen by any bot.`,
    );
  }
}
