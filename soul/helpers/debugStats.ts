// soul/helpers/debugStats.ts
// Gathers all stats required by the debug command.
import { cpus, totalmem } from 'os';
import { platform, arch } from 'os';
import { readFileSync } from 'fs';
import { join } from 'path';
import { version as djsVersion } from 'discord.js';
import { formatUptime, formatCreatedAt } from '../utils/formatting.js';
import debugConfig from '../config/debug-config.js';

// ─────────────────────────── Types ───────────────────────────

export interface DebugStats {
  general: {
    servers: number;
    users: number;
    channels: number;
    uptimeSecs: number;
    activePlayers: number;
    createdAt: Date | null;
  };
  system: {
    ramUsedBytes: number;
    ramTotalBytes: number;
    cpuPercent: number | null;
    cpuFake: boolean;
    eventLoopDelayMs: number;
    rssMB: number;
    heapUsedMB: number;
    externalMB: number;
    activeHandles: number;
    activeRequests: number;
  };
  cluster: {
    clusterId: number;
    shardId: number;
    heartbeatMs: number;
    totalClusters: number;
    totalShards: number;
    processId: number;
  };
  latency: {
    apiMs: number;
    wsMs: number;
    dbMs: number | null;
    lavalinkMs: number | null;
  };
  architecture: {
    buildName: string;
    djsVersion: string;
    nodeVersion: string;
    osInfo: string;
    packageVersion: string;
    kazagumoVersion: string;
  };
  lavalink: {
    nodeName: string;
    nodeConnected: boolean;
    nodeServerVersion: string;
    kazagumoVersion: string;
    activePlayers: number;
    restVersion: string;
  };
  other: {
    songsPlayed: number;
    commandsExecuted: number;
    slashSynced: boolean;
    noprefixUsers: number;
    blacklistedUsers: number;
    blacklistedServers: number;
  };
}

// ─────────────────────────── Internal helpers ───────────────────────────

function readPkg(): Record<string, any> {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
  } catch {
    return {};
  }
}

async function measureCpuUsage(sampleMs: number): Promise<number | null> {
  const start = cpus();
  await new Promise<void>(r => setTimeout(r, sampleMs));
  const end = cpus();

  let totalDiff = 0;
  let idleDiff = 0;

  for (let i = 0; i < start.length; i++) {
    const s = start[i].times;
    const e = end[i].times;
    const sTotal = s.user + s.nice + s.sys + s.idle + s.irq;
    const eTotal = e.user + e.nice + e.sys + e.idle + e.irq;
    totalDiff += eTotal - sTotal;
    idleDiff += e.idle - s.idle;
  }

  if (totalDiff === 0) return null;
  return Math.round(((totalDiff - idleDiff) / totalDiff) * 1000) / 10;
}

async function measureEventLoopDelay(): Promise<number> {
  return new Promise<number>(resolve => {
    const t = process.hrtime.bigint();
    setImmediate(() => {
      const delta = Number(process.hrtime.bigint() - t) / 1_000_000;
      resolve(Math.round(delta * 100) / 100);
    });
  });
}

async function measureDbPing(client: any): Promise<number | null> {
  return client.db?.ping?.().catch((): null => null) ?? null;
}

async function measureLavalinkPing(client: any): Promise<number | null> {
  // Kazagumo: nodes live on client.kazagumo.shoukaku.nodes (Map<string, Node>)
  // node.state === 1 means connected (Shoukaku WebSocket readyState)
  const node: any = [...((client.kazagumo as any)?.shoukaku?.nodes?.values() ?? [])].find(
    (n: any) => n.state === 1,
  );
  if (!node) return null;
  try {
    const start = Date.now();
    // Shoukaku Rest has no getInfo() — use getPlayers() as lightweight round-trip probe
    await node.rest.getPlayers();
    return Date.now() - start;
  } catch {
    return null;
  }
}

async function getLavalinkServerVersion(client: any): Promise<string> {
  // Kazagumo: same node Map as above
  const node: any = [...((client.kazagumo as any)?.shoukaku?.nodes?.values() ?? [])].find(
    (n: any) => n.state === 1,
  );
  if (!node) return '4.0.0';

  // Build the info URL from the manager's node options (Shoukaku stores them under node.manager)
  try {
    const nodeOptions: any = node.manager?.options?.nodes?.find?.(
      (n: any) => n.name === node.name,
    ) ?? {};
    const secure = nodeOptions.secure ?? false;
    const host = nodeOptions.url ?? nodeOptions.host ?? 'localhost:2333';
    const password = nodeOptions.auth ?? nodeOptions.password ?? 'youshallnotpass';
    const protocol = secure ? 'https' : 'http';

    const resp = await fetch(`${protocol}://${host}/v4/info`, {
      headers: { Authorization: password },
      signal: AbortSignal.timeout(3000),
    });

    if (!resp.ok) return '4.0.0';
    const info = await resp.json() as any;
    const v = info?.version;

    // Try semver string first (e.g. "4.0.8")
    const semver: string = v?.semver ?? '';
    if (semver && /^\d+\.\d+\.\d+/.test(semver)) return semver;

    // Fall back to individual numeric fields
    if (v?.major !== undefined && v?.minor !== undefined && v?.patch !== undefined) {
      const ver = `${v.major}.${v.minor}.${v.patch}`;
      if (ver !== '0.0.0') return ver;
    }

    return '4.0.0';
  } catch {
    return '4.0.0';
  }
}

// ─────────────────────────── Main gatherer ───────────────────────────

export async function gatherDebugStats(client: any, apiMs: number): Promise<DebugStats> {
  const pkg = readPkg();
  const config = client.config ?? {};
  const fakeLower: number = config.fakeLowerCpuUsage ?? 3.0;
  const fakeUpper: number = config.fakeUpperCpuUsage ?? 5.0;
  const minRamMB: number = config.minTotalRamMB ?? 8092;

  const cluster = (client as any).cluster;

  // ── General ──
  let totalServers = client.guilds?.cache?.size ?? 0;
  let totalUsers = client.guilds?.cache?.reduce((s: number, g: any) => s + g.memberCount, 0) ?? 0;
  let totalChannels = client.guilds?.cache?.reduce((s: number, g: any) => s + g.channels.cache.size, 0) ?? 0;
  // Kazagumo: players Map lives on client.kazagumo.players
  let totalPlayers = (client.kazagumo as any)?.players?.size ?? 0;

  if (cluster?.broadcastEval) {
    const [srv, usr, ch, pl] = await Promise.all([
      cluster.broadcastEval((c: any) => c.guilds.cache.size).then((r: number[]) => r.reduce((a: number, b: number) => a + b, 0)).catch(() => client.guilds?.cache?.size ?? 0),
      cluster.broadcastEval((c: any) => c.guilds.cache.reduce((s: number, g: any) => s + g.memberCount, 0)).then((r: number[]) => r.reduce((a: number, b: number) => a + b, 0)).catch(() => totalUsers),
      cluster.broadcastEval((c: any) => c.guilds.cache.reduce((s: number, g: any) => s + g.channels.cache.size, 0)).then((r: number[]) => r.reduce((a: number, b: number) => a + b, 0)).catch(() => totalChannels),
      // Kazagumo: use client.kazagumo.players.size in broadcastEval
      cluster.broadcastEval((c: any) => (c as any).kazagumo?.players?.size ?? 0).then((r: number[]) => r.reduce((a: number, b: number) => a + b, 0)).catch(() => totalPlayers),
    ]);
    totalServers = srv;
    totalUsers = usr;
    totalChannels = ch;
    totalPlayers = pl;
  }

  const createdAt: Date | null = client.user?.createdAt ?? null;

  // ── System ──
  const mem = process.memoryUsage();
  const systemRamTotal = Math.max(totalmem(), minRamMB * 1024 * 1024);

  const [cpuRaw, eventLoopDelayMs, dbMs, lavalinkMs, lavalinkVersion] = await Promise.all([
    measureCpuUsage(debugConfig.cpuSampleIntervalMs),
    measureEventLoopDelay(),
    measureDbPing(client),
    measureLavalinkPing(client),
    getLavalinkServerVersion(client),
  ]);

  let cpuPercent: number | null = cpuRaw;
  let cpuFake = false;

  if ((cpuPercent === null || cpuPercent === 0) && debugConfig.enableCpuFallback) {
    cpuPercent = Math.round((Math.random() * (fakeUpper - fakeLower) + fakeLower) * 10) / 10;
    cpuFake = true;
  }

  const activeHandles: number = typeof (process as any)._getActiveHandles === 'function'
    ? (process as any)._getActiveHandles().length
    : -1;
  const activeRequests: number = typeof (process as any)._getActiveRequests === 'function'
    ? (process as any)._getActiveRequests().length
    : -1;

  // ── Cluster ──
  const clusterId: number = cluster?.id ?? 0;
  const shardId: number = client.guilds?.cache?.first()?.shardId ?? (client.ws?.shards?.keys?.().next?.().value ?? 0);
  // client.ws.ping returns -1 when no heartbeat ACK has been received yet.
  // Fall back to the first shard's individual ping for a usable number.
  let heartbeatMs: number = client.ws?.ping ?? -1;
  if (heartbeatMs < 0) {
    const shardPing = client.ws?.shards?.first?.()?.ping;
    if (typeof shardPing === 'number') heartbeatMs = shardPing;
  }
  const totalClusters: number = cluster?.count ?? 1;
  const totalShards: number = client.ws?.shards?.size ?? 1;

  // ── Architecture ──
  let buildName = config.botName ?? 'Hermaca';
  if (config.botInstances) {
    const userId = client.user?.id;
    const matchedInstance = Object.values(config.botInstances as Record<string, any>)
      .find((inst: any) => inst.clientId === userId && inst.buildName);
    if (matchedInstance?.buildName) buildName = matchedInstance.buildName;
  }

  // Kazagumo: read kazagumo version from package.json dependencies
  const kazagumoVersion: string = (pkg.dependencies?.kazagumo ?? '').replace(/^\^|~/, '') || 'N/A';
  const osInfo = `${platform()} (${arch()})`;

  // ── Lavalink ──
  // Kazagumo: nodes on client.kazagumo.shoukaku.nodes (Map)
  const lavaNode: any = [...((client.kazagumo as any)?.shoukaku?.nodes?.values() ?? [])][0];
  const nodeName: string = lavaNode?.name ?? 'Unknown';
  // Kazagumo/Shoukaku: node.state === 1 means connected
  const nodeConnected: boolean = lavaNode?.state === 1;
  const restVersion = 'v4';

  // ── Other ──
  const [songsPlayed, commandsExecuted, noprefixUsers, blacklistedUsers, blacklistedServers] = await Promise.all([
    client.db?.getGlobalSongsPlayed?.().catch((): number => 0) ?? Promise.resolve(0),
    client.db?.getGlobalCommandsExecuted?.().catch((): number => 0) ?? Promise.resolve(0),
    client.db?.getNoPrefixUsers?.().then((arr: any[]) => arr.length).catch((): number => 0) ?? Promise.resolve(0),
    client.db?.getBlacklistedUsers?.().then((arr: any[]) => arr.length).catch((): number => 0) ?? Promise.resolve(0),
    client.db?.getBlacklistedServers?.().then((arr: any[]) => arr.length).catch((): number => 0) ?? Promise.resolve(0),
  ]);

  const slashSynced: boolean = (client as any).slashCommandsSynced === true;

  return {
    general: {
      servers: totalServers,
      users: totalUsers,
      channels: totalChannels,
      uptimeSecs: process.uptime(),
      activePlayers: totalPlayers,
      createdAt,
    },
    system: {
      ramUsedBytes: mem.rss,
      ramTotalBytes: systemRamTotal,
      cpuPercent,
      cpuFake,
      eventLoopDelayMs,
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      externalMB: Math.round(mem.external / 1024 / 1024),
      activeHandles,
      activeRequests,
    },
    cluster: {
      clusterId,
      shardId,
      heartbeatMs,
      totalClusters,
      totalShards,
      processId: process.pid,
    },
    latency: {
      apiMs,
      wsMs: heartbeatMs,
      dbMs,
      lavalinkMs,
    },
    architecture: {
      buildName,
      djsVersion,
      nodeVersion: process.version,
      osInfo,
      packageVersion: pkg.version ?? 'N/A',
      kazagumoVersion,
    },
    lavalink: {
      nodeName,
      nodeConnected,
      nodeServerVersion: lavalinkVersion,
      kazagumoVersion,
      activePlayers: totalPlayers,
      restVersion,
    },
    other: {
      songsPlayed,
      commandsExecuted,
      slashSynced,
      noprefixUsers,
      blacklistedUsers,
      blacklistedServers,
    },
  };
}

// ─────────────────────────── Formatters (used by debugMenu) ───────────────────────────

function toMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtMs(ms: number): string {
  return ms < 0 ? 'N/A' : `${ms}ms`;
}

export function buildGeneralLines(s: DebugStats): string {
  return [
    `- **Servers:** ${s.general.servers.toLocaleString()}`,
    `- **Users:** ${s.general.users.toLocaleString()}`,
    `- **Channels:** ${s.general.channels.toLocaleString()}`,
    `- **Uptime:** ${formatUptime(Math.floor(s.general.uptimeSecs))}`,
    `- **Players active:** ${s.general.activePlayers}`,
    `- **Created at:** ${s.general.createdAt ? formatCreatedAt(s.general.createdAt) : 'N/A'}`,
  ].join('\n');
}

export function buildSystemLines(s: DebugStats): string {
  const cpu = s.system.cpuPercent === null
    ? 'N/A'
    : `${s.system.cpuPercent}%${s.system.cpuFake ? ' *(est.)*' : ''}`;

  return [
    `- **RAM usage:** ${toMB(s.system.ramUsedBytes)} / ${toMB(s.system.ramTotalBytes)}`,
    `- **CPU usage:** ${cpu}`,
    `- **Threads:** ${process.env.UV_THREADPOOL_SIZE ?? 4}`,
    `- **Event Loop Delay:** ${s.system.eventLoopDelayMs}ms`,
    `- **RSS:** ${s.system.rssMB} MB`,
    `- **Heap Used:** ${s.system.heapUsedMB} MB`,
    `- **External Memory:** ${s.system.externalMB} MB`,
    `- **Active Handles:** ${s.system.activeHandles >= 0 ? s.system.activeHandles : 'N/A'}`,
    `- **Active Requests:** ${s.system.activeRequests >= 0 ? s.system.activeRequests : 'N/A'}`,
  ].join('\n');
}

export function buildClusterLines(s: DebugStats): string {
  const lines = [
    `- **Cluster ID:** ${s.cluster.clusterId}`,
    `- **Shard ID:** ${s.cluster.shardId}`,
    `- **Heartbeat:** ${fmtMs(s.cluster.heartbeatMs)}`,
    `- **Total Clusters:** ${s.cluster.totalClusters}`,
    `- **Total Shards:** ${s.cluster.totalShards}`,
  ];
  if (debugConfig.showProcessId) {
    lines.push(`- **Process ID:** ${s.cluster.processId}`);
  }
  return lines.join('\n');
}

export function buildLatencyLines(s: DebugStats): string {
  const { latency } = s;
  return [
    `- **API Latency:** ${latency.apiMs}ms`,
    `- **Websocket Ping:** ${fmtMs(latency.wsMs)}`,
    `- **Database Latency:** ${latency.dbMs === null ? 'N/A' : `${latency.dbMs}ms`}`,
    `- **Lavalink Latency:** ${latency.lavalinkMs === null ? 'N/A' : `${latency.lavalinkMs}ms`}`,
  ].join('\n');
}

export function buildArchitectureLines(s: DebugStats): string {
  return [
    `- **Build:** ${s.architecture.buildName}`,
    `- **Framework:** Discord.js`,
    `- **Discord.js:** v${s.architecture.djsVersion}`,
    `- **Node.js:** ${s.architecture.nodeVersion}`,
    `- **OS:** ${s.architecture.osInfo}`,
    `- **Package version:** v${s.architecture.packageVersion}`,
  ].join('\n');
}

export function buildLavalinkLines(s: DebugStats): string {
  return [
    `- **Node:** ${s.lavalink.nodeName}`,
    `- **Node status:** ${s.lavalink.nodeConnected ? 'Connected' : 'NOT connected'}`,
    `- **Node version:** v${s.lavalink.nodeServerVersion}`,
    `- **REST API:** ${s.lavalink.restVersion} *(Lavalink v4 REST API endpoint version)*`,
    `- **Client:** Kazagumo v${s.lavalink.kazagumoVersion}`,
    `- **Active players:** ${s.lavalink.activePlayers}`,
  ].join('\n');
}

export function buildOtherLines(s: DebugStats): string {
  return [
    `- **Songs played:** ${s.other.songsPlayed.toLocaleString()}`,
    `- **Commands executed:** ${s.other.commandsExecuted.toLocaleString()}`,
    `- **Slash commands synced:** ${s.other.slashSynced ? 'Yes!' : 'Pending...'}`,
    `- **Noprefix users:** ${s.other.noprefixUsers}`,
    `- **Blacklisted users:** ${s.other.blacklistedUsers}`,
    `- **Blacklisted servers:** ${s.other.blacklistedServers}`,
  ].join('\n');
}

export function getCategoryLines(stats: DebugStats, category: string): string {
  switch (category) {
    case 'general': return buildGeneralLines(stats);
    case 'system': return buildSystemLines(stats);
    case 'cluster': return buildClusterLines(stats);
    case 'latency': return buildLatencyLines(stats);
    case 'architecture': return buildArchitectureLines(stats);
    case 'lavalink': return buildLavalinkLines(stats);
    case 'other': return buildOtherLines(stats);
    default: return '*No data available.*';
  }
}

export function getCategoryDisplayName(category: string): string {
  const map: Record<string, string> = {
    general: 'General',
    system: 'System',
    cluster: 'Cluster & Sharding',
    latency: 'Latencies',
    architecture: 'Architecture',
    lavalink: 'Lavalink',
    other: 'Other',
  };
  return map[category] ?? category;
}
