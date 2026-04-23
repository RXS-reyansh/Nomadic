// soul/events/player/debug.ts
// Shoukaku emits 'debug' on shoukaku (type: 'node'), not on kazagumo (type: 'player').
// Args: (nodeName: string, message: string)
import logger from '../../console/logger.js';

export const name = 'debug';
export const type = 'node';

export async function execute(_client: any, nodeName: string, message: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('SHOUKAKU', `[${nodeName}] ${message}`);
  }
}
