// soul/components/lastfm.ts
//
// Components V2 panel builders shared across all fm* commands. Every panel
// follows the same shape:
//   ## {title}
//   ───
//   {body lines, each pre-formatted with bullets / numbering / etc.}
//   ───
//   -# {footer}
// All payloads ship with `allowedMentions: { parse: [] }` to avoid pings.

import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

const NO_MENTIONS = { parse: [] as any[] };

export interface ListPanelOptions {
  title: string;
  /** Pre-formatted body lines (markdown allowed). */
  lines: string[];
  /** When `lines` is empty, render this message in italics. */
  emptyMessage?: string;
  footer?: string;
  /** Optional thumbnail / image to attach below the body. */
  imageUrl?: string | null;
  /** Optional sub-header rendered above the body (e.g. user info). */
  subHeader?: string;
}

export function buildListPanel(opts: ListPanelOptions): any {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${opts.title}`),
  );

  if (opts.subHeader) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(opts.subHeader));
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  if (opts.lines.length) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(opts.lines.join('\n')),
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`*${opts.emptyMessage ?? 'Nothing to show.'}*`),
    );
  }

  if (opts.imageUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(opts.imageUrl)),
    );
  }

  if (opts.footer) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(opts.footer));
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}

/**
 * Profile-card style panel — heading + key/value lines + thumbnail + footer.
 * Used by `fmprofile`, `fm`, `fmartist`, `fmtrack`, `fmalbum`.
 */
export interface ProfilePanelOptions {
  title: string;
  /** Key-value lines, e.g. `[['Plays', '1,234'], ...]`. */
  fields: Array<[string, string]>;
  imageUrl?: string | null;
  footer?: string;
  /** Free-form body (e.g. wiki summary) rendered after the field list. */
  body?: string;
}

export function buildProfilePanel(opts: ProfilePanelOptions): any {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${emojis.musicHeartNote} ${opts.title}`),
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  if (opts.fields.length) {
    const fieldText = opts.fields.map(([k, v]) => `**${k}:** ${v}`).join('\n');
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(fieldText));
  }

  if (opts.body) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(opts.body));
  }

  if (opts.imageUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(opts.imageUrl)),
    );
  }

  if (opts.footer) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(opts.footer));
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}

/** "Now playing on Last.fm" panel — special-cased layout for the `fm` command. */
export interface NowScrobblingOptions {
  username: string;
  isLive: boolean;
  trackName: string;
  trackUrl: string;
  artist: string;
  album?: string | null;
  imageUrl?: string | null;
  /** Per-track scrobble count for this user — `track.getInfo` `userplaycount`. */
  userPlayCount?: number | null;
  /** Total scrobbles for the user — `user.getInfo` `playcount`. */
  totalScrobbles?: number | null;
  /** Relative timestamp string for non-live mode (e.g. `<t:123:R>`). */
  scrobbledAt?: string | null;
}

export function buildNowScrobbling(opts: NowScrobblingOptions): any {
  const heading = opts.isLive
    ? `## ${emojis.cutemusic} ${opts.username} is now scrobbling`
    : `## ${emojis.musicHeartNote} ${opts.username}'s last scrobble`;

  const trackLine = `**[${opts.trackName.replace(/[\[\]]/g, '')}](${opts.trackUrl})**`;
  const artistLine = `by **${opts.artist}**`;
  const albumLine = opts.album ? `on *${opts.album}*` : null;

  const meta: string[] = [];
  if (opts.userPlayCount != null && opts.userPlayCount > 0) {
    meta.push(`${opts.userPlayCount} play${opts.userPlayCount === 1 ? '' : 's'} of this track`);
  }
  if (opts.totalScrobbles != null) {
    meta.push(`${opts.totalScrobbles.toLocaleString('en-US')} total scrobbles`);
  }
  if (!opts.isLive && opts.scrobbledAt) {
    meta.push(`scrobbled ${opts.scrobbledAt}`);
  }

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(heading))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [trackLine, artistLine, albumLine].filter(Boolean).join('\n'),
      ),
    );

  if (meta.length) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(meta.map((m) => `> ${m}`).join('\n')),
    );
  }

  if (opts.imageUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(opts.imageUrl)),
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Powered by Last.fm • [Open profile](https://www.last.fm/user/${encodeURIComponent(opts.username)})`,
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  };
}
