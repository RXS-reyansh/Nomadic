import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'error';
export const type = 'discord';

export async function execute(_client: any, error: Error): Promise<void> {
  logger.error('CLIENT', `Discord client error: ${error.message}`);
  if (error.stack) logger.debug('CLIENT', error.stack);
  webhookLogger.logError(error, 'Discord Client Error');
}