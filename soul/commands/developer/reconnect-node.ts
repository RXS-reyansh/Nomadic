// soul/commands/developer/reconnect-node.ts
// Triggers a reconnect on disconnected Lavalink nodes, then waits for the
// Shoukaku 'ready' event and mentions the developer when one connects.
//
// Handles two cases:
//   A) Node is in shoukaku.nodes but state !== 1  → node.connect()
//   B) Node is in config but removed from pool   → shoukaku.addNode()
//
// Usage:
//   reconnect-node             — reconnects every node that is not Connected
//   reconnect-node <name>      — reconnects the named node regardless of state
//
// Message flow:
//   1. sendLoading  → "Reconnecting to a Lavalink node..."  (reply to command)
//   2. sendSuccess  → "<@dev> Reconnected **{name}** node." (standalone channel msg)
//      OR sendError → timed out                             (standalone channel msg)
//
// RACE CONDITION FIX: The 'ready' listener + polling interval are registered
// BEFORE connect()/addNode() is called. If the node connects during the
// sendLoading await, the event/poll will still catch it.
import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendLoading, sendSuccess } from '../../components/statusMessages.js';
import { emojis } from '../../emojis.js';

export const options = {
  name: 'reconnect-node',
  aliases: ['reconnectnode', 'rn'] as string[],
  description: 'Force a reconnection attempt on one or all Lavalink nodes.',
  usage: 'reconnect-node [node name]',
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 0,
};

const RECONNECT_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 500;

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };

  const shoukaku = (client as any).kazagumo?.shoukaku;
  if (!shoukaku) return sendError(ctx, 'Kazagumo/Shoukaku is not initialised.');

  const liveNodes: Map<string, any> = shoukaku.nodes;
  const configNodes: Array<{ name: string; host: string; port: number; auth: string; secure?: boolean }> =
    (client as any).config?.nodes ?? [];

  // ── Resolve which nodes to reconnect ────────────────────────────────────
  // needsConnect = in pool but not Connected  → call node.connect()
  // needsAdd     = in config, removed from pool → call shoukaku.addNode()
  const needsConnect: any[] = [];
  const needsAdd: typeof configNodes = [];

  if (args.length > 0) {
    const targetName = args.join(' ');
    const liveNode = liveNodes.get(targetName);
    if (liveNode) {
      needsConnect.push(liveNode);
    } else {
      const configEntry = configNodes.find(n => n.name === targetName);
      if (!configEntry) {
        const allNames = [
          ...[...liveNodes.keys()],
          ...configNodes.map(n => n.name).filter(n => !liveNodes.has(n)),
        ].map(n => `\`${n}\``).join(', ');
        return sendError(ctx, `Node \`${targetName}\` not found. Available: ${allNames}`);
      }
      needsAdd.push(configEntry);
    }
  } else {
    for (const node of liveNodes.values()) {
      if ((node as any).state !== 1) needsConnect.push(node);
    }
    for (const entry of configNodes) {
      if (!liveNodes.has(entry.name)) needsAdd.push(entry);
    }
    if (needsConnect.length === 0 && needsAdd.length === 0) {
      return sendSuccess(ctx, 'All nodes are already connected. Nothing to do.');
    }
  }

  const targetNames = new Set<string>([
    ...needsConnect.map((n: any) => n.name as string),
    ...needsAdd.map(n => n.name),
  ]);

  // ── 1. Set up the ready-promise FIRST (before connect/addNode) ────────────
  // Combines event listener + polling fallback so we never miss the state=1
  // transition regardless of timing.
  const readyPromise = new Promise<string | null>((resolve) => {
    let settled = false;

    const finish = (name: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      shoukaku.removeListener('ready', onReady);
      resolve(name);
    };

    // Timeout
    const timer = setTimeout(() => finish(null), RECONNECT_TIMEOUT_MS);

    // Event-based: Shoukaku fires 'ready' when a node gets the Lavalink READY op
    function onReady(name: string) {
      if (targetNames.has(name)) finish(name);
    }
    shoukaku.on('ready', onReady);

    // Polling fallback: catches state=1 even if the event was somehow missed
    const poll = setInterval(() => {
      const live: Map<string, any> = shoukaku.nodes;
      for (const name of targetNames) {
        const node = live.get(name);
        if (node && (node as any).state === 1) finish(name);
      }
    }, POLL_INTERVAL_MS);
  });

  // ── 2. Send loading reply ────────────────────────────────────────────────
  await sendLoading(ctx, 'Reconnecting to a Lavalink node...');

  // ── 3. Kick off reconnect / re-add attempts ──────────────────────────────
  for (const node of needsConnect) {
    node.connect().catch((): null => null);
  }
  for (const entry of needsAdd) {
    try {
      shoukaku.addNode(entry);
    } catch {
      // ignore if already re-added by another path
    }
  }

  // ── 4. Wait for result ───────────────────────────────────────────────────
  const connectedNodeName = await readyPromise;

  // Both success and timeout arrive as standalone channel messages (not replies)
  const channelCtx = { channel: message.channel };

  if (!connectedNodeName) {
    return sendError(channelCtx, 'Reconnect timed out — no node connected within 15 seconds.');
  }

  // Build success panel with an actual ping for the developer
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${emojis.blacktick} <@${message.author.id}> Reconnected **${connectedNodeName}** node.`,
    ),
  );

  await (message.channel as any).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [message.author.id as string] },
  }).catch((): null => null);
}
