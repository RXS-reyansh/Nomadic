// soul/events/node/nodeDisconnect.ts
// Shoukaku event: 'disconnect' — fires when a node disconnects
// Args: (name: string, players: Player[], moved: boolean)
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'disconnect';
export const type = 'node';

export const execute = (_client: any, nodeName: string, _players: any[], moved: boolean): void => {
  const reason = moved ? 'players moved to another node' : 'connection lost';
  logger.warn('NODE', `⚠️ Lavalink node "${nodeName}" disconnected. Reason: ${reason}`);
  webhookLogger.logNode('disconnect', nodeName);
};
