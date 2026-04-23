// soul/helpers/nowPlayingManager.ts
import { sendNowPlaying, buildNowPlayingPayload, type NowPlayingTrackInfo } from '../components/nowPlaying.js';
import { extractThumbnail, formatDuration } from '../utils/formatting.js';

interface PositionSnapshot {
  position: number;
  time: number;
}

interface StoredMessage {
  channelId: string;
  messageId: string;
  isQueueEnd: boolean;
}

interface PlayerState {
  positionSnapshot?: PositionSnapshot;
  nowPlayingMessage?: StoredMessage;
}

const playerStates = new Map<string, PlayerState>();

function getState(guildId: string): PlayerState {
  if (!playerStates.has(guildId)) playerStates.set(guildId, {});
  return playerStates.get(guildId)!;
}

export function setPositionSnapshot(guildId: string, position: number): void {
  getState(guildId).positionSnapshot = { position, time: Date.now() };
}

export function clearPlayerState(guildId: string): void {
  playerStates.delete(guildId);
}

export function markMessageAsQueueEnd(guildId: string): void {
  const state = getState(guildId);
  if (state.nowPlayingMessage) {
    state.nowPlayingMessage.isQueueEnd = true;
  }
}

function formatPosition(ms: number): string {
  if (!ms || ms <= 0) return '00:00';
  return formatDuration(ms);
}

function getInterpolatedPosition(player: any): number {
  const snapshot = getState(player.guildId).positionSnapshot;
  if (!snapshot) return player.position ?? 0;

  const elapsed = player.playing && !player.paused ? Date.now() - snapshot.time : 0;
  // Kazagumo: current track is player.queue.current; length is track.length (no .info wrapper)
  const length = player.queue?.current?.length ?? 0;
  const interpolated = snapshot.position + elapsed;
  return length > 0 ? Math.min(interpolated, length) : interpolated;
}

export function buildTrackInfo(player: any, track: any): NowPlayingTrackInfo {
  const position = getInterpolatedPosition(player);
  // Kazagumo tracks are flat — no .info wrapper
  const length = track.length ?? 0;

  const requester = track.requester;
  const requestedBy = (requester as any)?.username ?? undefined;

  return {
    title: track.title,
    artist: track.author || 'Unknown',
    url: track.uri,
    sourceName: track.sourceName || 'Unknown',
    durationFormatted: length > 0 ? formatDuration(length) : 'LIVE',
    currentFormatted: formatPosition(position),
    progress: length > 0 ? Math.min(100, (position / length) * 100) : 0,
    // Kazagumo tracks have a built-in thumbnail property; fall back to extractThumbnail
    thumbnailUrl: track.thumbnail ?? extractThumbnail(track) ?? undefined,
    volume: player.volume ?? 100,
    isServerVolume:
      player.data?.get?.('serverVolume') !== undefined &&
      player.data.get('serverVolume') === (player.volume ?? 100),
    requestedBy,
  };
}

async function fetchStoredMessage(client: any, stored: StoredMessage): Promise<any | null> {
  try {
    const channel = client.channels.cache.get(stored.channelId);
    if (!channel) return null;
    return await (channel as any).messages.fetch(stored.messageId).catch((): null => null);
  } catch {
    return null;
  }
}

export async function deleteOldNowPlayingMessage(client: any, guildId: string): Promise<void> {
  const state = getState(guildId);
  const stored = state.nowPlayingMessage;
  if (!stored || stored.isQueueEnd) return;

  const msg = await fetchStoredMessage(client, stored);
  if (msg) await msg.delete().catch(() => {});

  state.nowPlayingMessage = undefined;
}

export async function disableNowPlayingButtons(client: any, player: any): Promise<void> {
  const guildId = player.guildId;
  const state = getState(guildId);
  const stored = state.nowPlayingMessage;
  if (!stored) return;

  // Kazagumo: on playerEmpty, queue.current is already null — fall back to last played track
  const track = player.queue?.current ?? player.queue?.previous?.[0];
  if (!track) return;

  const prefix = client.config?.prefix;
  const trackInfo = buildTrackInfo(player, track);
  const payload = buildNowPlayingPayload(player, trackInfo, { allDisabled: true, prefix }) as any;

  const msg = await fetchStoredMessage(client, stored);
  if (msg) await msg.edit(payload).catch(() => {});
}

export async function sendNowPlayingMessage(
  client: any,
  player: any,
  track: any,
): Promise<any> {
  // Kazagumo: text channel ID is player.textId
  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  const prefix = client.config?.prefix;
  const trackInfo = buildTrackInfo(player, track);
  const msg = await sendNowPlaying({ channel }, player, trackInfo, { prefix }).catch((): null => null);

  if (msg) {
    getState(player.guildId).nowPlayingMessage = {
      channelId: (channel as any).id,
      messageId: msg.id,
      isQueueEnd: false,
    };
  }

  return msg;
}

export async function updateNowPlayingMessage(client: any, player: any): Promise<void> {
  const state = getState(player.guildId);
  const stored = state.nowPlayingMessage;
  if (!stored) return;

  // Kazagumo: current track is player.queue.current
  const track = player.queue?.current;
  if (!track) return;

  const prefix = client.config?.prefix;
  const trackInfo = buildTrackInfo(player, track);
  const payload = buildNowPlayingPayload(player, trackInfo, { prefix }) as any;

  const msg = await fetchStoredMessage(client, stored);
  if (msg) {
    await msg.edit(payload).catch(() => {});
    return;
  }

  // Original message gone — send a new one
  const channel = client.channels.cache.get(player.textId);
  if (!channel) return;

  const trackInfo2 = buildTrackInfo(player, track);
  const newMsg = await sendNowPlaying({ channel }, player, trackInfo2, { prefix }).catch((): null => null);
  if (newMsg) {
    state.nowPlayingMessage = {
      channelId: (channel as any).id,
      messageId: newMsg.id,
      isQueueEnd: false,
    };
  }
}
