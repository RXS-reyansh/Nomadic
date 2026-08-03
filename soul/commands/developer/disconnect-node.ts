// soul/commands/developer/disconnect-node.ts
// Force-disconnects whichever Lavalink node is currently Connected (state=1)
// and removes it from the Shoukaku pool.
//
// Uses `reconnect-node` to bring it back.
//
// KEY: We neuter the node's internal `connect()` method before calling
// removeNode() so that Shoukaku's built-in reconnect loop (which fires
// immediately on close) runs as a no-op instead of re-establishing the WS.
// Without this, the Node auto-reconnects within ~1s even after removeNode(),
// leaving a "ghost" WS session that blocks reconnect-node's addNode() call.
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';

export const options = {
  name: 'disconnect-node',
  aliases: ['disconnectnode', 'dn'] as string[],
  description: 'Force-disconnect the currently connected Lavalink node.',
  usage: 'disconnect-node',
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 0,
};

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const ctx = { message };

  const shoukaku = (client as any).kazagumo?.shoukaku;
  if (!shoukaku) return sendError(ctx, 'Kazagumo/Shoukaku is not initialised.');

  const liveNodes: Map<string, any> = shoukaku.nodes;

  // Find the currently connected node (state === 1)
  const connectedNode = [...liveNodes.values()].find((n: any) => n.state === 1) ?? null;
  if (!connectedNode) {
    return sendError(ctx, 'No node is currently connected. Nothing to disconnect.');
  }

  const nodeName: string = connectedNode.name;

  // Neuter the node's connect() so Shoukaku's built-in reconnect loop runs
  // as a no-op instead of re-establishing the WebSocket connection.
  (connectedNode as any).connect = async (): Promise<void> => {};

  try {
    shoukaku.removeNode(nodeName, 'force-disconnect');
  } catch {
    return sendError(ctx, `Failed to disconnect node **${nodeName}**.`);
  }

  return sendSuccess(ctx, `Disconnected the node **${nodeName}**.`);
}
