// soul/events/node/nodeError.ts
// Shoukaku event: 'error' — fires when a node emits an error
// Args: (name: string, error: Error | AggregateError)
//
// Silencing strategy:
//   1. If ANY other node is already CONNECTED (state === 1), suppress
//      entirely — errors from backup nodes are noise when audio works.
//   2. Otherwise log + webhook on the FIRST occurrence of each error
//      code per node, then suppress repeats until nodeConnect.ts calls
//      clearNodeSilence(nodeName) on a successful (re)connect.
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

// Set of "nodeName::code" keys we have already logged and silenced.
const silenced = new Set<string>();

/** Called by nodeConnect.ts when a node successfully (re)connects. */
export function clearNodeSilence(nodeName: string): void {
  for (const key of silenced) {
    if (key.startsWith(`${nodeName}::`)) silenced.delete(key);
  }
}

/** Extract a stable error code from any error shape. */
function errorCode(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.code) return String(err.code);
  if (err?.errors?.[0]?.code) return String(err.errors[0].code);
  return err?.constructor?.name ?? err?.name ?? 'unknown';
}

/** Returns true if at least one Shoukaku node (other than `errorNodeName`) is CONNECTED. */
function hasConnectedNode(client: any, errorNodeName: string): boolean {
  const nodes: Map<string, any> = client?.kazagumo?.shoukaku?.nodes;
  if (!nodes) return false;
  for (const [name, node] of nodes) {
    if (name !== errorNodeName && node.state === 1 /* CONNECTED */) return true;
  }
  return false;
}

export const name = 'error';
export const type = 'node';

export const execute = (client: any, nodeName: string, error: any): void => {
  // If another node is already serving audio, silently ignore this error.
  if (hasConnectedNode(client, nodeName)) return;

  const code = errorCode(error);
  const key = `${nodeName}::${code}`;

  if (silenced.has(key)) return;

  silenced.add(key);
  logger.error('NODE', `❌ Lavalink node "${nodeName}" error: ${code}`);
  webhookLogger.logNode('error', nodeName, error);
};
