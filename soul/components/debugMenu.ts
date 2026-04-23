// soul/components/debugMenu.ts
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
import debugConfig from '../config/debug-config.js';
import config from '../config.js';
import type { DebugStats } from '../helpers/debugStats.js';
import {
  buildGeneralLines,
  buildSystemLines,
  buildClusterLines,
  buildLatencyLines,
  buildArchitectureLines,
  buildLavalinkLines,
  buildOtherLines,
  getCategoryDisplayName,
} from '../helpers/debugStats.js';
import { getHostingProviderName } from '../helpers/getHostingServiceIP.js';

// ─────────────────────────── Session tracking ───────────────────────────

export interface DebugSession {
  page: string;
  stats: DebugStats;
  userId: string;
  authorUsername: string;
  channelId: string;
  prefix: string;
  sentAt: string;
  client: any;
}

export const debugSessions = new Map<string, DebugSession>();
const debugTimeouts = new Map<string, NodeJS.Timeout>();

export function registerDebugSession(messageId: string, session: DebugSession): void {
  debugSessions.set(messageId, session);
  resetDebugTimeout(messageId);
}

export function resetDebugTimeout(messageId: string, _interaction?: any): void {
  const session = debugSessions.get(messageId);
  if (!session) return;

  clearTimeout(debugTimeouts.get(messageId));

  const timeout = setTimeout(async () => {
    try {
      const channel = await session.client.channels.fetch(session.channelId);
      const message = await (channel as any).messages.fetch(messageId);
      let payload: any;
      if (session.page === 'allstats') {
        payload = buildDebugAllStatsPayload(session.stats, session.authorUsername, session.prefix, session.sentAt, true, session.client);
      } else if (session.page === 'home') {
        payload = buildDebugHomePayload(session.stats, session.authorUsername, session.prefix, session.sentAt, true, session.client);
      } else {
        payload = buildDebugCategoryPayload(session.stats, session.page, session.authorUsername, session.prefix, session.sentAt, true, session.client);
      }
      await message.edit(payload);
    } catch (_err) {
      // Message deleted or inaccessible — silently ignore
    } finally {
      debugSessions.delete(messageId);
      debugTimeouts.delete(messageId);
    }
  }, debugConfig.sessionTimeoutMs);

  debugTimeouts.set(messageId, timeout);
}

// ─────────────────────────── Category definitions ───────────────────────────

const DEBUG_CATEGORIES = [
  { key: 'general',      label: 'General',            description: 'Servers, users, uptime and players' },
  { key: 'system',       label: 'System',             description: 'RAM, CPU and thread metrics' },
  { key: 'cluster',      label: 'Cluster & Sharding', description: 'Cluster ID, shards and heartbeat' },
  { key: 'latency',      label: 'Latencies',          description: 'API, WS, database and Lavalink pings' },
  { key: 'architecture', label: 'Architecture',       description: 'Build, versions and platform info' },
  { key: 'lavalink',     label: 'Lavalink',           description: 'Node status, version and client info' },
  { key: 'other',        label: 'Other',              description: 'Lifetime counters and sync status' },
];

// ─────────────────────────── Internal builders ───────────────────────────

function buildNavRow(page: string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Home')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId('debug:home')
      .setEmoji({ id: '1495280509948006410', name: 'butterflyBlack', animated: true })
      .setDisabled(disabled || page === 'home'),
    new ButtonBuilder()
      .setLabel('All stats')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId('debug:allstats')
      .setEmoji({ id: '1494789956034629734', name: 'butterflyWhite', animated: true })
      .setDisabled(disabled || page === 'allstats'),
  );
}

function buildNavDropdown(botName: string, disabled = false): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = DEBUG_CATEGORIES.map(cat =>
    new StringSelectMenuOptionBuilder()
      .setValue(cat.key)
      .setLabel(cat.label)
      .setDescription(cat.description)
      .setEmoji({ id: '1495274694851694602', name: 'blackBughunter', animated: false }),
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('debug:nav')
    .setPlaceholder(`Browse through ${botName}'s stats`)
    .addOptions(options)
    .setDisabled(disabled);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/** Format the current UTC time as HH:MM for use as sentAt. */
export function formatSentAt(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

function buildFooter(authorUsername: string, prefix: string, sentAt: string): string {
  return `-# Requested by ${authorUsername} at ${sentAt} UTC | Use \`${prefix}developer\` for info about developer`;
}

/** Builds the "Database on X / Powered by Y" text shown inside the header section. */
function buildInfoLines(): string {
  const provider = getHostingProviderName();
  const db = (config as any).databaseProvider ?? 'MongoDB Atlas';
  const language = (config as any).language ?? 'TypeScript';
  return `Database on **${db}**\nPowered by **${provider}**\nWritten in **${language}**`;
}

// ─────────────────────────── Public payload builders ───────────────────────────

export function buildDebugHomePayload(
  stats: DebugStats,
  authorUsername: string,
  prefix: string,
  sentAt: string,
  disabled = false,
  client?: any,
): object {
  const botName: string = (client as any)?.config?.botName ?? 'Hermaca';
  const avatarUrl: string = (client as any)?.user?.displayAvatarURL?.({ forceStatic: false }) ?? '';

  const categoryList = DEBUG_CATEGORIES
    .map(cat => `${emojis.blackBughunter} **${cat.label}**`)
    .join('\n');

  // Info lines are placed INSIDE the section (left of thumbnail) to avoid
  // the gap that appears when they are placed as a separate component after
  // a SectionBuilder that has a tall thumbnail accessory.
  const headerText = `# ${emojis.blackbatman} Stats of ${botName}\n${buildInfoLines()}`;

  const headerSection = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(headerText),
  );
  if (avatarUrl) {
    headerSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));
  }

  const container = new ContainerBuilder()
    .addSectionComponents(headerSection)
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(categoryList))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(buildNavRow('home', disabled))
    .addActionRowComponents(buildNavDropdown(botName, disabled) as any)
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildFooter(authorUsername, prefix, sentAt)));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

export function buildDebugCategoryPayload(
  stats: DebugStats,
  category: string,
  authorUsername: string,
  prefix: string,
  sentAt: string,
  disabled = false,
  client?: any,
): object {
  const botName: string = (client as any)?.config?.botName ?? 'Hermaca';
  const displayName = getCategoryDisplayName(category);

  let lines: string;
  switch (category) {
    case 'general':      lines = buildGeneralLines(stats); break;
    case 'system':       lines = buildSystemLines(stats); break;
    case 'cluster':      lines = buildClusterLines(stats); break;
    case 'latency':      lines = buildLatencyLines(stats); break;
    case 'architecture': lines = buildArchitectureLines(stats); break;
    case 'lavalink':     lines = buildLavalinkLines(stats); break;
    case 'other':        lines = buildOtherLines(stats); break;
    default:             lines = '*No data available.*';
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emojis.blackBughunter} Stats - ${displayName}`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(buildNavRow(category, disabled))
    .addActionRowComponents(buildNavDropdown(botName, disabled) as any)
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildFooter(authorUsername, prefix, sentAt)));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

export function buildDebugAllStatsPayload(
  stats: DebugStats,
  authorUsername: string,
  prefix: string,
  sentAt: string,
  disabled = false,
  client?: any,
): object {
  const botName: string = (client as any)?.config?.botName ?? 'Hermaca';
  const avatarUrl: string = (client as any)?.user?.displayAvatarURL?.({ forceStatic: false }) ?? '';

  // Same layout as home: info lines inside the section, left of thumbnail
  const headerText = `# ${emojis.blackbatman} All stats of ${botName}\n${buildInfoLines()}`;

  const headerSection = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(headerText),
  );
  if (avatarUrl) {
    headerSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));
  }

  const container = new ContainerBuilder().addSectionComponents(headerSection);

  const sections: Array<{ label: string; lines: string }> = [
    { label: 'General',            lines: buildGeneralLines(stats) },
    { label: 'System',             lines: buildSystemLines(stats) },
    { label: 'Cluster & Sharding', lines: buildClusterLines(stats) },
    { label: 'Latencies',          lines: buildLatencyLines(stats) },
    { label: 'Architecture',       lines: buildArchitectureLines(stats) },
    { label: 'Lavalink',           lines: buildLavalinkLines(stats) },
    { label: 'Other',              lines: buildOtherLines(stats) },
  ];

  for (const { label, lines } of sections) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${label}\n${lines}`));
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(buildNavRow('allstats', disabled))
    .addActionRowComponents(buildNavDropdown(botName, disabled) as any)
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(buildFooter(authorUsername, prefix, sentAt)));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}
