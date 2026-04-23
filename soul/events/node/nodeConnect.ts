// soul/events/node/nodeConnect.ts
// Shoukaku event: 'ready' — fires when a node connects (first connection or resume)
// Attached to client.kazagumo.shoukaku (type: 'node')
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'ready';
export const type = 'node';

export const execute = (_client: any, name: string, resumed: boolean): void => {
  if (resumed) {
    logger.success('NODE', `🔄 Lavalink node "${name}" resumed session.`);
    webhookLogger.logNode('reconnect', name);
  } else {
    logger.success('NODE', `✅ Lavalink node "${name}" connected!`);
    logger.info('NODE', `🎵 Music system is ready for playback.`);
    webhookLogger.logNode('connect', name);
  }
};
