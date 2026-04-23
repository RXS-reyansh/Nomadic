import { MessageFlags } from 'discord.js';
import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { emojis } from '../../emojis.js';
import { buildPingPayload } from '../../components/ping.js';

async function measureDbPing(client: HermacaClient): Promise<number | null> {
  return client.db.ping().catch((): null => null);
}

async function measureLavalinkPing(client: HermacaClient): Promise<number | null> {
  // Kazagumo: nodes live on client.kazagumo.shoukaku.nodes (Map<string, Node>)
  // node.state === 1 means connected (Shoukaku uses the numeric WebSocket readyState enum)
  const node: any = [...(client.kazagumo as any).shoukaku.nodes.values()].find(
    (n: any) => n.state === 1,
  );
  if (!node) return null;
  try {
    const start = Date.now();
    // Shoukaku Rest has no getInfo() helper — use getPlayers() as a lightweight round-trip
    await node.rest.getPlayers();
    return Date.now() - start;
  } catch {
    return null;
  }
}

export const options = {
  name: 'ping',
  aliases: [] as string[],
  description: "Check the bot's latency and connection health.",
  usage: 'ping',
  category: 'info',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const before = Date.now();

  const loadingContainer = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${emojis.loading} Checking latencies…`),
  );
  const sent = await message.channel.send({
    components: [loadingContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  const apiLatency = Date.now() - before;

  const [dbLatency, lavalinkLatency] = await Promise.all([
    measureDbPing(client),
    measureLavalinkPing(client),
  ]);

  // client.ws.ping returns -1 when no heartbeat ACK has been received yet.
  // Fall back to the first shard's individual ping, which often reports a
  // valid value before the manager-level average does.
  let rawWsPing = Math.round(client.ws.ping);
  if (rawWsPing < 0) {
    const shardPing = (client.ws as any)?.shards?.first?.()?.ping;
    if (typeof shardPing === 'number' && shardPing >= 0) rawWsPing = Math.round(shardPing);
  }
  const wsPing: number | null = rawWsPing < 0 ? null : rawWsPing;

  const clusterId: number = (client.cluster as any)?.id ?? 0;
  const shardId: number = (message.guild as any)?.shardId ?? 0;

  const guildPrefix: string = message.guild
    ? ((await client.helpers.getGuildPrefix?.(message.guild.id).catch((): null => null)) ?? client.config.prefix)
    : client.config.prefix;

  const sentAt = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

  const container = buildPingPayload({
    clusterId,
    shardId,
    apiLatency,
    wsPing,
    dbLatency,
    lavalinkLatency,
    guildPrefix,
    authorUsername: message.author.username,
    sentAt,
  });

  await sent.edit({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}
