// soul/components/playerAlerts.ts
//
// Components V2 panels used by player-side alert events:
//   • playerStuck   → "stalled, trying alternate source"  (initial)
//                   → "recovered via X"                   (retry succeeded)
//                   → "skipped, source unrecoverable"     (retry failed / second stall)
//   • playerException → "playback error"                  (Lavalink raised an exception)
//
// All panels carry `allowedMentions: { parse: [] }` so they can never ping anyone,
// match the visual language of addedToQueue / nowPlaying (Section + Thumbnail
// accessory + Separator), and use the source-emoji set already registered in
// `soul/emojis.ts`.

import {
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

const NO_MENTIONS = { parse: [] as any[] };

export interface StuckTrackInfo {
  title: string;
  author?: string;
  url?: string;
  thumbnail?: string;
  sourceName?: string;
}

// ── Source / search-prefix helpers ──────────────────────────────────────────

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

function prettySource(sourceName?: string): string {
  switch (sourceName?.toLowerCase()) {
    case 'youtube': return 'YouTube';
    case 'youtubemusic': return 'YouTube Music';
    case 'spotify': return 'Spotify';
    case 'deezer': return 'Deezer';
    case 'applemusic': return 'Apple Music';
    case 'soundcloud': return 'SoundCloud';
    default: return sourceName ?? 'Unknown';
  }
}

function prefixEmoji(prefix: string): string {
  switch (prefix) {
    case 'ytmsearch': return emojis.youtubeMusic;
    case 'ytsearch': return emojis.youtube;
    case 'dzsearch': return emojis.deezer;
    case 'spsearch': return emojis.spotify;
    case 'amsearch': return emojis.appleMusic;
    case 'scsearch': return emojis.soundcloud;
    default: return emojis.music;
  }
}

function prettyPrefix(prefix: string): string {
  switch (prefix) {
    case 'ytmsearch': return 'YouTube Music';
    case 'ytsearch': return 'YouTube';
    case 'dzsearch': return 'Deezer';
    case 'spsearch': return 'Spotify';
    case 'amsearch': return 'Apple Music';
    case 'scsearch': return 'SoundCloud';
    default: return prefix;
  }
}

function buildDetailsSection(track: StuckTrackInfo, body: string): SectionBuilder {
  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(body),
  );
  if (track.thumbnail) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(track.thumbnail));
  }
  return section;
}

// ── 1. Initial: "stalled — trying alternate source" ────────────────────────

export function buildTrackStuckRetryingPayload(
  track: StuckTrackInfo,
  retrySourcePrefix: string,
): any {
  const titleLink = track.url ? `[${track.title}](${track.url})` : track.title;
  const oldSrc = `${getSourceEmoji(track.sourceName)} ${prettySource(track.sourceName)}`;
  const newSrc = `${prefixEmoji(retrySourcePrefix)} ${prettyPrefix(retrySourcePrefix)}`;
  const artist = track.author ? `\n- **Artist:** ${track.author}` : '';

  const container = new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${emojis.loading} Track stalled — trying an alternate source…`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addSectionComponents(
      buildDetailsSection(
        track,
        `# **${titleLink}**${artist}\n- **Original source:** ${oldSrc}\n- **Retrying via:** ${newSrc}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '-# Lavalink stopped receiving audio frames from the source. Re-resolving from a different source before giving up.',
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}

// ── 2. Success: "recovered via X" ──────────────────────────────────────────

export function buildTrackRecoveredPayload(
  track: StuckTrackInfo,
  recoveredSourcePrefix: string,
): any {
  const titleLink = track.url ? `[${track.title}](${track.url})` : track.title;
  const oldSrc = `${getSourceEmoji(track.sourceName)} ${prettySource(track.sourceName)}`;
  const newSrc = `${prefixEmoji(recoveredSourcePrefix)} ${prettyPrefix(recoveredSourcePrefix)}`;
  const artist = track.author ? `\n- **Artist:** ${track.author}` : '';

  const container = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${emojis.blacktick} Recovered after stall`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addSectionComponents(
      buildDetailsSection(
        track,
        `# **${titleLink}**${artist}\n- **Stalled on:** ${oldSrc}\n- **Recovered via:** ${newSrc}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '-# Track was re-resolved from a different source after the original feed dropped.',
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}

// ── 3. Failure: "unrecoverable, skipping" ──────────────────────────────────

export function buildTrackUnrecoverablePayload(track: StuckTrackInfo, reason?: string): any {
  const titleLink = track.url ? `[${track.title}](${track.url})` : track.title;
  const sourceLine = `${getSourceEmoji(track.sourceName)} ${prettySource(track.sourceName)}`;
  const artist = track.author ? `\n- **Artist:** ${track.author}` : '';

  const tail = reason
    ? `-# ${reason}`
    : '-# Lavalink track-stuck — usually a CDN/network issue on the source side.';

  const container = new ContainerBuilder()
    .setAccentColor(0xe67e22)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${emojis.redcross} Track skipped — source unrecoverable`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addSectionComponents(
      buildDetailsSection(
        track,
        `# **${titleLink}**${artist}\n- **Source:** ${sourceLine}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(tail));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}

// ── 4. Generic playback error (used by trackError.ts) ──────────────────────

export function buildTrackErrorPayload(track: StuckTrackInfo, errorMessage: string): any {
  const titleLink = track.url ? `[${track.title}](${track.url})` : track.title;
  const sourceLine = `${getSourceEmoji(track.sourceName)} ${prettySource(track.sourceName)}`;
  const artist = track.author ? `\n- **Artist:** ${track.author}` : '';

  const container = new ContainerBuilder()
    .setAccentColor(0xe74c3c)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${emojis.redcross} Track playback error`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addSectionComponents(
      buildDetailsSection(
        track,
        `# **${titleLink}**${artist}\n- **Source:** ${sourceLine}\n- **Reason:** ${errorMessage}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '-# Lavalink raised an exception while streaming this track. Skipping to the next one.',
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}
