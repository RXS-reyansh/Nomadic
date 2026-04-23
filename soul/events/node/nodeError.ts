// soul/events/node/nodeError.ts
// Shoukaku event: 'error' — fires when a node emits an error
// Args: (name: string, error: Error)
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'error';
export const type = 'node';

export const execute = (_client: any, nodeName: string, error: Error): void => {
  logger.error('NODE', `❌ Lavalink node "${nodeName}" error: ${error.message}`);
  webhookLogger.logNode('error', nodeName, error);
};
