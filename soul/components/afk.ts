import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

export type AfkScope = 'server' | 'global';

export interface AfkPayloadOptions {
  reason: string;
  imageUrl: string | null;
  sessionId: string;
  disabled?: boolean;
  footer?: string;
}

export interface AfkNoticeOptions {
  displayName: string;
  sinceAt: Date;
  tillAt?: Date | null;
  reason: string;
  imageUrl: string | null;
  mentionedBy: string;
  mentionedAt?: Date;
}

export function buildAfkConfirmationPayload(options: AfkPayloadOptions): any {
  const footer = options.footer ?? '-# AFK gets removed when you send a message.';
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${emojis.AFK} Away from Keyboard Confirmation`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## Are you sure you want to set your AFK status to:'),
      new TextDisplayBuilder().setContent(options.reason),
    );

  if (options.imageUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(options.imageUrl)),
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`afk:${options.sessionId}:server`)
          .setLabel('Server AFK')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(options.disabled ?? false),
        new ButtonBuilder()
          .setCustomId(`afk:${options.sessionId}:global`)
          .setLabel('Global AFK')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(options.disabled ?? false),
        new ButtonBuilder()
          .setCustomId(`afk:${options.sessionId}:cancel`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(options.disabled ?? false),
      ),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

export function buildAfkNoticePayload(options: AfkNoticeOptions): any {
  const since = toRelativeTimestamp(options.sinceAt);
  const mentionedAt = formatClock(options.mentionedAt ?? new Date());
  const untilLine = options.tillAt ? `\nTill: ${toRelativeTimestamp(options.tillAt)}` : '';
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${emojis.whiteGhost} ${options.displayName} is Away from Keyboard!`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Since: ${since}${untilLine}\nReason: ${options.reason}`),
    );

  if (options.imageUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(options.imageUrl)),
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Mentioned by ${options.mentionedBy} at ${mentionedAt}`));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

export function buildAfkRemovedPayload(durationText: string, removedAt: Date = new Date()): any {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.bluePlanet} Your AFK has been removed. You were away for ${durationText}.`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# At ${formatFullDateTime(removedAt)}`));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

export function formatHumanDuration(ms: number): string {
  let seconds = Math.max(0, Math.floor(ms / 1000));
  const units = [
    ['century', 100 * 365 * 24 * 60 * 60],
    ['decade', 10 * 365 * 24 * 60 * 60],
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ] as const;
  const parts: string[] = [];

  for (const [name, size] of units) {
    const value = Math.floor(seconds / size);
    if (!value) continue;
    seconds -= value * size;
    parts.push(`${value} ${name}${value === 1 ? '' : 's'}`);
  }

  if (!parts.length) return '0 seconds';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function toRelativeTimestamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatFullDateTime(date: Date): string {
  return `${formatClock(date)}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}