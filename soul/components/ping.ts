import {
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

export interface PingStats {
  clusterId: number;
  shardId: number;
  apiLatency: number;
  wsPing: number | null;
  dbLatency: number | null;
  lavalinkLatency: number | null;
  guildPrefix: string;
  authorUsername: string;
  sentAt: string;
}

function fmt(ms: number | null): string {
  return ms === null ? 'N/A' : `${ms}ms`;
}

export function buildPingPayload(stats: PingStats): object {
  const {
    clusterId,
    shardId,
    apiLatency,
    wsPing,
    dbLatency,
    lavalinkLatency,
    guildPrefix,
    authorUsername,
    sentAt,
  } = stats;

  const hasIssue = dbLatency === null || lavalinkLatency === null;

  const statusLine = hasIssue
    ? '### The bot is NOT working properly.'
    : '### The bot is working perfectly.';

  const statsBlock = [
    statusLine,
    `- API Latency: ${fmt(apiLatency)}`,
    `- Websocket Ping: ${fmt(wsPing)}`,
    `- Database Latency: ${fmt(dbLatency)}`,
    `- Lavalink Latency: ${fmt(lavalinkLatency)}`,
    `- Shard ID: ${shardId}`,
  ].join('\n');

  const footerLine = `-# Requested by ${authorUsername} at ${sentAt} UTC | For more info use \`${guildPrefix}debug\` command.`;

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${emojis.redBlackCross} Cluster ${clusterId}`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(statsBlock))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footerLine));
}
