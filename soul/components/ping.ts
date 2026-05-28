import {
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

export interface PingStats {
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
    apiLatency,
    wsPing,
    dbLatency,
    lavalinkLatency,
    guildPrefix,
    authorUsername,
    sentAt,
  } = stats;

  const hasIssue =
    dbLatency === null ||
    lavalinkLatency === null ||
    (typeof apiLatency === 'number' && apiLatency > 500) ||
    (typeof wsPing === 'number' && wsPing > 500) ||
    (typeof dbLatency === 'number' && dbLatency > 500) ||
    (typeof lavalinkLatency === 'number' && lavalinkLatency > 500);

  const headerLine = hasIssue
    ? `## ${emojis.redBlackCross} The bot is NOT working properly.`
    : `## ${emojis.redBlackCross} The bot is working perfectly.`;

  const statsBlock = [
    `- API Latency: ${fmt(apiLatency)}`,
    `- Websocket Ping: ${fmt(wsPing)}`,
    `- Database Latency: ${fmt(dbLatency)}`,
    `- Lavalink Latency: ${fmt(lavalinkLatency)}`,
  ].join('\n');

  const footerLine = `-# Requested by ${authorUsername} at ${sentAt} UTC | For more info use \`${guildPrefix}debug\` command.`;

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(headerLine),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(statsBlock))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footerLine));
}
