// soul/events/node/nodeCreate.ts
// Shoukaku has no 'nodeCreate' event — this event will never fire.
// Kept for structural consistency; connect/resume logic lives in nodeConnect.ts (ready event).
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'nodeCreate';
export const type = 'node';

export const execute = (_client: any, name: string): void => {
  logger.info('NODE', `🆕 Lavalink node "${name}" created.`);
  webhookLogger.logNode('create', name);
};
