// soul/events/node/nodeReconnect.ts
// Shoukaku has no separate 'nodeReconnect' event — reconnection is signalled by
// the 'ready' event with resumed=true (handled in nodeConnect.ts).
// This file is kept for structural consistency but will never fire.
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'nodeReconnect';
export const type = 'node';

export const execute = (_client: any, nodeName: string): void => {
  logger.info('NODE', `🔄 Lavalink node "${nodeName}" reconnected.`);
  webhookLogger.logNode('reconnect', nodeName);
};
