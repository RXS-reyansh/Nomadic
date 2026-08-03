// soul/commands/developer/node-status.ts
// Shows which Lavalink node is connected and lists the remaining configured nodes.
//
// Connected:  sendInfo  "**{name}** is connected. Available nodes: {others, Oxford-comma}"
// None:       sendError "No node is connected. Available nodes: {all, Oxford-comma}"
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendInfo } from '../../components/statusMessages.js';

export const options = {
  name: 'node-status',
  aliases: ['nodestatus', 'ns'] as string[],
  description: 'Show which Lavalink node is connected and list all other configured nodes.',
  usage: 'node-status',
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 0,
};

/** Returns an Oxford-comma-separated string from an array of names. */
function oxfordList(names: string[]): string {
  if (names.length === 0) return 'none';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const ctx = { message };

  const shoukaku = (client as any).kazagumo?.shoukaku;
  if (!shoukaku) return sendError(ctx, 'Kazagumo/Shoukaku is not initialised.');

  const configNodes: Array<{ name: string }> = (client as any).config?.nodes ?? [];
  if (configNodes.length === 0) return sendError(ctx, 'No nodes are configured.');

  const liveNodes: Map<string, any> = shoukaku.nodes;

  // Pick the first node that is fully Connected (state === 1)
  const connectedNode = [...liveNodes.values()].find((n: any) => n.state === 1) ?? null;

  const allNames = configNodes.map(n => n.name);

  if (connectedNode) {
    const otherNames = allNames.filter(n => n !== connectedNode.name);
    return sendInfo(
      ctx,
      `**${connectedNode.name}** is connected. Available nodes: ${oxfordList(otherNames)}`,
    );
  }

  return sendError(
    ctx,
    `No node is connected. Available nodes: ${oxfordList(allNames)}`,
  );
}
