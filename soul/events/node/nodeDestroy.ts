// soul/events/node/nodeDestroy.ts
// Shoukaku event: 'close' — fires when a node connection closes
// Args: (name: string, code: number, reason: string)
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'close';
export const type = 'node';

export const execute = (_client: any, nodeName: string, code: number, reason: string): void => {
  logger.warn('NODE', `💀 Lavalink node "${nodeName}" closed. Code: ${code}, Reason: ${reason || 'None'}`);
  webhookLogger.logNode('destroy', nodeName);
};
