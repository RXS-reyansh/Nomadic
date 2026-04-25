// soul/structures/StatusManager.ts
//
// Drives the bot's gateway presence + Custom Status + status pill.
// Configuration lives in `soul/config/botInstances.ts`. The manager picks
// the entry matching the running clientId and applies it.
//
// Three independent rotators (any/all may be "single" or "multi"):
//   • displayStatus rotator — cycles through the array of status pills.
//   • status         rotator — cycles through statusEntries.
//   • presence       rotator — cycles through presenceEntries.
//
// Only one of (statusEntries / presenceEntries) is *applied* at a time —
// `inst.mode` decides which family is currently shown. The other family's
// rotator still ticks so when/if the manager is asked to switch modes the
// indices are coherent. (Switching mode at runtime isn't currently exposed
// but the design accommodates it.)
//
// The "mobile" device hint is NOT applied here — see HermacaClient: the
// IDENTIFY payload's browser/os/device must be set BEFORE the gateway
// handshake, which is the only point at which the icon can be installed.

import { ActivityType, type Client } from 'discord.js';
import { GatewayOpcodes } from 'discord-api-types/v10';
import logger from '../console/logger.js';
import {
  ROTATION_INTERVAL_MS,
  type BotInstance,
  type DisplayStatus,
  type PresenceOnlyEntry,
  type StatusOnlyEntry,
  findBotInstanceByClientId,
} from '../config/botInstances.js';

const ACTIVITY_TYPE_MAP: Record<string, ActivityType> = {
  Playing: ActivityType.Playing,
  Listening: ActivityType.Listening,
  Watching: ActivityType.Watching,
  Competing: ActivityType.Competing,
  Streaming: ActivityType.Streaming,
  Custom: ActivityType.Custom,
};

/** "mobile" is a device hint — the gateway status itself must be online/idle/dnd/invisible. */
function toGatewayStatus(s: DisplayStatus): 'online' | 'idle' | 'dnd' | 'invisible' {
  return s === 'mobile' ? 'online' : s;
}

function interpolate(client: Client, text: string): string {
  const guilds = client.guilds?.cache?.size ?? 0;
  let users = 0;
  client.guilds?.cache?.forEach((g: any) => { users += g.memberCount ?? 0; });
  return text
    .replace(/\{guilds\}/g, String(guilds))
    .replace(/\{users\}/g, String(users))
    .replace(/\{botName\}/g, client.user?.username ?? 'Bot');
}

export class StatusManager {
  private client: Client;
  private instance: BotInstance | null;

  private displayStatusList: DisplayStatus[];
  private displayStatusIdx = 0;

  private statusList: StatusOnlyEntry[];
  private statusIdx = 0;

  private presenceList: PresenceOnlyEntry[];
  private presenceIdx = 0;

  private timers: NodeJS.Timeout[] = [];
  private initialApplied = false;

  constructor(client: Client, clientId?: string | null) {
    this.client = client;
    this.instance = findBotInstanceByClientId(clientId ?? client.user?.id ?? null);

    const inst = this.instance;
    this.displayStatusList = inst
      ? (Array.isArray(inst.displayStatus) ? inst.displayStatus : [inst.displayStatus])
      : ['online'];
    this.statusList = inst?.statusEntries ?? [];
    this.presenceList = inst?.presenceEntries ?? [];
  }

  hasMatchedInstance(): boolean {
    return this.instance !== null;
  }

  /** Friendly label for ready-log / debug. */
  getInstanceName(): string | null {
    return this.instance?.name ?? null;
  }

  /** Build the activity payload that should be applied at gateway IDENTIFY. */
  static buildInitialPresenceFor(inst: BotInstance | null): {
    activities: any[];
    status: 'online' | 'idle' | 'dnd' | 'invisible';
  } | null {
    if (!inst) return null;
    const ds = Array.isArray(inst.displayStatus) ? inst.displayStatus[0] : inst.displayStatus;
    const status = toGatewayStatus(ds);

    if (inst.mode === 'status') {
      const e = inst.statusEntries?.[0];
      if (!e) return { activities: [], status };
      return {
        activities: [{ name: e.text, type: ActivityType.Custom, state: e.text }],
        status,
      };
    }

    const e = inst.presenceEntries?.[0];
    if (!e) return { activities: [], status };
    const kind = e.activityType ?? 'Playing';
    const type = ACTIVITY_TYPE_MAP[kind] ?? ActivityType.Playing;
    const activity: any = { name: e.text, type };
    if (kind === 'Streaming' && e.streamUrl) activity.url = e.streamUrl;
    return { activities: [activity], status };
  }

  /**
   * Apply the first entry, then start any rotators that are "multi". Safe to
   * call once per ready event.
   */
  start(): void {
    if (!this.instance) {
      logger.warn?.('STATUS', `No bot instance matched clientId ${this.client.user?.id ?? '?'}`);
      return;
    }
    const inst = this.instance;

    if (inst.mode === 'status' && this.statusList.length === 0) {
      logger.warn?.('STATUS', `Instance "${inst.name}" mode=status but has no statusEntries.`);
    }
    if (inst.mode === 'presence' && this.presenceList.length === 0) {
      logger.warn?.('STATUS', `Instance "${inst.name}" mode=presence but has no presenceEntries.`);
    }

    this.applyCurrent(/*announce=*/true);

    // displayStatus rotation
    if (this.displayStatusList.length > 1) {
      this.timers.push(setInterval(() => {
        this.displayStatusIdx = (this.displayStatusIdx + 1) % this.displayStatusList.length;
        this.applyCurrent(false);
      }, ROTATION_INTERVAL_MS));
    }
    // status rotation
    if (inst.statusRotation === 'multi' && this.statusList.length > 1) {
      this.timers.push(setInterval(() => {
        this.statusIdx = (this.statusIdx + 1) % this.statusList.length;
        this.applyCurrent(false);
      }, ROTATION_INTERVAL_MS));
    }
    // presence rotation
    if (inst.presenceRotation === 'multi' && this.presenceList.length > 1) {
      this.timers.push(setInterval(() => {
        this.presenceIdx = (this.presenceIdx + 1) % this.presenceList.length;
        this.applyCurrent(false);
      }, ROTATION_INTERVAL_MS));
    }
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  // ── internals ────────────────────────────────────────────────────────────

  private applyCurrent(announce: boolean): void {
    if (!this.instance || !this.client.user) return;
    const inst = this.instance;
    const pill = this.displayStatusList[this.displayStatusIdx] ?? 'online';
    const status = toGatewayStatus(pill);

    let activities: any[] = [];

    if (inst.mode === 'status') {
      const e = this.statusList[this.statusIdx];
      if (e) {
        const text = interpolate(this.client, e.text);
        activities = [{ name: text, type: ActivityType.Custom, state: text }];
      }
    } else {
      const e = this.presenceList[this.presenceIdx];
      if (e) {
        const text = interpolate(this.client, e.text);
        const kind = e.activityType ?? 'Playing';
        const type = ACTIVITY_TYPE_MAP[kind] ?? ActivityType.Playing;
        const activity: any = { name: text, type };
        if (kind === 'Streaming') {
          if (!e.streamUrl) {
            logger.warn?.('STATUS', `Streaming entry "${text}" has no streamUrl — Discord will reject it.`);
          } else {
            activity.url = e.streamUrl;
          }
        }
        activities = [activity];
      }
    }

    // We send the raw gateway packet ourselves instead of going through
    // `client.user.setPresence(...)`. discord.js's `ClientPresence._parse`
    // only forwards `{type, name, state, url}` and silently strips `emoji`,
    // which means custom emojis on Custom Status would never reach Discord.
    try {
      const ws: any = (this.client as any).ws;
      ws.broadcast({
        op: GatewayOpcodes.PresenceUpdate,
        d: { activities, status, afk: false, since: null },
      });
    } catch (err) {
      logger.error('STATUS', `presence broadcast failed: ${(err as Error).message}`);
      return;
    }

    // Only log on the very first apply — silence rotation chatter.
    if (announce && !this.initialApplied) {
      this.initialApplied = true;
      logger.success('STATUS', `Applied status "${inst.name}" (displayStatus=${pill})`);
    }
  }
}
