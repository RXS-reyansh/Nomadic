// soul/components/queueMenu.ts
//
// Components V2 renderer for the `queue` command. Renders the full session
// history with a Now Playing summary (with thumbnail), Completed + Heading
// Your Way sections, 8 entries per page, a jump-to dropdown, and Previous /
// Page (clickable, opens modal) / Next / Refresh buttons. Layout follows
// soul/bitchin'/queue-fix.txt.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';
import { formatDuration } from '../utils/formatting.js';
import { getSession, type SessionEntry } from '../helpers/sessionQueue.js';

// ────────────────────────────── Constants ──────────────────────────────

export const QUEUE_PAGE_SIZE = 8;
const SESSION_TIMEOUT_MS = 3 * 60 * 1000;
const DIVIDER = '⟡';

// ────────────────────────────── Session tracking ──────────────────────────────

export interface QueueMenuSession {
  guildId: string;
  channelId: string;
  userId: string;
  authorUsername: string;
  prefix: string;
  page: number;
  client: any;
}

export const queueSessions = new Map<string, QueueMenuSession>();
const queueTimeouts = new Map<string, NodeJS.Timeout>();

export function registerQueueSession(messageId: string, session: QueueMenuSession): void {
  queueSessions.set(messageId, session);
  resetQueueTimeout(messageId);
}

export function resetQueueTimeout(messageId: string): void {
  const session = queueSessions.get(messageId);
  if (!session) return;

  clearTimeout(queueTimeouts.get(messageId));

  const timeout = setTimeout(async () => {
    try {
      const channel = await session.client.channels.fetch(session.channelId);
      const message = await (channel as any).messages.fetch(messageId);
      const player = session.client.kazagumo.players.get(session.guildId);
      const payload = buildQueuePayload(player, session, true);
      await message.edit(payload);
    } catch (_err) {
      // Message deleted or inaccessible — silently ignore
    } finally {
      queueSessions.delete(messageId);
      queueTimeouts.delete(messageId);
    }
  }, SESSION_TIMEOUT_MS);

  queueTimeouts.set(messageId, timeout);
}

// ────────────────────────────── Helpers ──────────────────────────────

function getSourceEmoji(sourceName?: string): string {
  switch (sourceName?.toLowerCase()) {
    case 'youtube': return emojis.youtube;
    case 'youtubemusic': return emojis.youtubeMusic;
    case 'spotify': return emojis.spotify;
    case 'deezer': return emojis.deezer;
    case 'applemusic': return emojis.appleMusic;
    case 'soundcloud': return emojis.soundcloud;
    default: return emojis.music;
  }
}

function trackTitle(entry: SessionEntry, max = 60): string {
  const title = entry.track?.title ?? 'Unknown';
  return title.length > max ? title.slice(0, max - 1) + '…' : title;
}

function trackAuthor(entry: SessionEntry): string {
  return entry.track?.author ?? 'Unknown';
}

function trackDuration(entry: SessionEntry): string {
  return entry.track?.length ? formatDuration(entry.track.length) : 'LIVE';
}

/** Returns the user's display username (NOT a mention). */
function trackRequester(entry: SessionEntry): string {
  const r = entry.requester as any;
  if (!r) return 'Unknown';
  if (typeof r === 'string') return r;
  return r.globalName || r.displayName || r.username || r.tag || 'Unknown';
}

function totalDurationMs(entries: SessionEntry[]): number {
  let sum = 0;
  for (const e of entries) sum += e.track?.length ?? 0;
  return sum;
}

/**
 * Build a "completed" or "upcoming" entry block. Title is plain text — only
 * the Now Playing title is hyperlinked.
 *   **N.** (source emoji) Song name
 *   > Artist: (Artist name)
 *   > Requested by (username) ⟡ (duration)
 */
function entryBlock(entry: SessionEntry, absIndex: number): string {
  const src = getSourceEmoji(entry.track?.sourceName);
  return [
    `**${absIndex + 1}.** ${src} ${trackTitle(entry)}`,
    `> Artist: ${trackAuthor(entry)}`,
    `> Requested by ${trackRequester(entry)} ${DIVIDER} ${trackDuration(entry)}`,
  ].join('\n');
}

/** Now-Playing line: `**N.** (source emoji) [song](uri) - Artist` */
function nowPlayingLine(entry: SessionEntry, absIndex: number): string {
  const src = getSourceEmoji(entry.track?.sourceName);
  const titleText = trackTitle(entry);
  const titleLink = entry.track?.uri ? `[${titleText}](${entry.track.uri})` : titleText;
  return `**${absIndex + 1}.** ${src} ${titleLink} - ${trackAuthor(entry)}`;
}

/** Returns the page (1-indexed) that contains the given absolute index. */
function pageForIndex(absIndex: number): number {
  return Math.floor(absIndex / QUEUE_PAGE_SIZE) + 1;
}

// ────────────────────────────── Payload builder ──────────────────────────────

export function buildQueuePayload(
  player: any,
  session: QueueMenuSession,
  disabled = false,
): object {
  const botName: string = (session.client as any)?.config?.botName ?? 'Hermaca';
  const headerTitle = `# ${emojis.musicHeartNote} __${botName} Music Queue__`;
  const footerLine = `-# Thank you for using ${botName}!`;

  // ─── No player at all ────────────────────────────────────────────────
  if (!player || !player.queue) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerTitle))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`*Nothing has been queued in this server.*`),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(footerLine));
    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }

  const state = getSession(player);
  const entries = state.entries;
  const currentIndex = state.currentIndex;

  // ─── Empty session ───────────────────────────────────────────────────
  if (!entries.length) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerTitle))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `*The queue is empty. Use \`${session.prefix}play <song>\` to add songs.*`,
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(footerLine));
    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }

  // ─── Pagination ──────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(entries.length / QUEUE_PAGE_SIZE));
  let page = session.page;
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  session.page = page;

  const pageStart = (page - 1) * QUEUE_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + QUEUE_PAGE_SIZE, entries.length);

  // Split this page's entries into completed / now-playing / upcoming
  const completedOnPage: { entry: SessionEntry; absIndex: number }[] = [];
  const upcomingOnPage: { entry: SessionEntry; absIndex: number }[] = [];
  let nowOnPage: { entry: SessionEntry; absIndex: number } | null = null;

  for (let i = pageStart; i < pageEnd; i++) {
    const entry = entries[i];
    if (i < currentIndex) completedOnPage.push({ entry, absIndex: i });
    else if (i === currentIndex) nowOnPage = { entry, absIndex: i };
    else upcomingOnPage.push({ entry, absIndex: i });
  }

  // ─── Header counters ─────────────────────────────────────────────────
  const playedCount = currentIndex >= 0 ? currentIndex : 0;
  const upcomingCount = currentIndex >= 0
    ? entries.length - currentIndex - 1
    : entries.length;
  const totalDur = formatDuration(totalDurationMs(entries), true);

  // ─── Build container ─────────────────────────────────────────────────
  const container = new ContainerBuilder();

  // Title
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerTitle));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // Now Playing block (h2) — wrapped in a SectionBuilder so we can attach
  // the current track's thumbnail as an accessory.
  const npLines: string[] = ['## Now Playing'];
  let nowPlayingThumb: string | undefined;
  if (nowOnPage) {
    npLines.push(nowPlayingLine(nowOnPage.entry, nowOnPage.absIndex));
    nowPlayingThumb = nowOnPage.entry.track?.thumbnail;
  } else if (currentIndex >= 0 && entries[currentIndex]) {
    // Current track exists but isn't on this page — point user at the right page.
    const onPage = pageForIndex(currentIndex);
    npLines.push(`*Track #${currentIndex + 1} is playing — view page #${onPage} to see it.*`);
    nowPlayingThumb = entries[currentIndex].track?.thumbnail;
  } else {
    npLines.push('*Nothing is playing right now.*');
  }
  npLines.push(`**${playedCount}** played ${DIVIDER} **${upcomingCount}** upcoming`);
  npLines.push(`**Total session length:** ${totalDur}`);

  if (nowPlayingThumb) {
    const npSection = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(npLines.join('\n')))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(nowPlayingThumb));
    container.addSectionComponents(npSection);
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(npLines.join('\n')));
  }
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // Completed + Heading Your Way (single combined block, no internal separator)
  const sectionLines: string[] = [];
  if (completedOnPage.length) {
    sectionLines.push('### Completed:');
    for (const { entry, absIndex } of completedOnPage) {
      sectionLines.push(entryBlock(entry, absIndex));
      sectionLines.push(''); // spacer between entries
    }
  }
  if (upcomingOnPage.length) {
    sectionLines.push('### Heading Your Way:');
    for (const { entry, absIndex } of upcomingOnPage) {
      sectionLines.push(entryBlock(entry, absIndex));
      sectionLines.push('');
    }
  }
  if (sectionLines.length) {
    while (sectionLines[sectionLines.length - 1] === '') sectionLines.pop();
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sectionLines.join('\n')),
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  }

  // ─── Jump dropdown (one option per visible entry on this page) ───────
  const allOnPage = [...completedOnPage, ...(nowOnPage ? [nowOnPage] : []), ...upcomingOnPage]
    .sort((a, b) => a.absIndex - b.absIndex);

  const jumpOptions = allOnPage.map(({ entry, absIndex }) => {
    const direction = absIndex < currentIndex
      ? 'Rewind to'
      : absIndex === currentIndex
        ? 'Currently playing'
        : 'Fast-forward to';
    return new StringSelectMenuOptionBuilder()
      .setValue(String(absIndex))
      .setLabel(`#${absIndex + 1}  ${trackTitle(entry, 80)}`)
      .setDescription(`${direction} ${DIVIDER} ${trackAuthor(entry)}`.slice(0, 100))
      .setDefault(absIndex === currentIndex);
  });

  const jumpRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('queue:jump')
      .setPlaceholder('Jump to a track on this page…')
      .addOptions(jumpOptions)
      .setDisabled(disabled || jumpOptions.length === 0),
  );
  container.addActionRowComponents(jumpRow as any);

  // ─── Pagination + Refresh buttons ────────────────────────────────────
  // Page button is green (Success) and clickable — it opens a modal so the
  // user can type any page number directly.
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('queue:prev')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Previous')
      .setDisabled(disabled || page <= 1),
    new ButtonBuilder()
      .setCustomId('queue:goto')
      .setStyle(ButtonStyle.Success)
      .setLabel(`Page ${page}/${totalPages}`)
      .setDisabled(disabled || totalPages <= 1),
    new ButtonBuilder()
      .setCustomId('queue:next')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Next')
      .setDisabled(disabled || page >= totalPages),
    new ButtonBuilder()
      .setCustomId('queue:refresh')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Refresh')
      .setDisabled(disabled),
  );
  container.addActionRowComponents(navRow);

  // ─── Footer ──────────────────────────────────────────────────────────
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerLine));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

/**
 * Returns the page (1-indexed) that contains the now-playing entry, or 1 if
 * nothing is playing.
 */
export function pageForCurrent(player: any): number {
  if (!player) return 1;
  const state = getSession(player);
  if (state.currentIndex < 0) return 1;
  return pageForIndex(state.currentIndex);
}
