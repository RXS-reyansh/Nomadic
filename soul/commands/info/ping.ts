import { MessageFlags } from 'discord.js';
import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { emojis } from '../../emojis.js';
import { buildPingPayload } from '../../components/ping.js';
import { resolveWsPing } from '../../utils/wsPing.js';

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

  const wsPing: number | null = resolveWsPing(client, apiLatency);

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
