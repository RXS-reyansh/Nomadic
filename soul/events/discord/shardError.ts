import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'shardError';
export const type = 'discord';

export async function execute(_client: any, error: Error, shardId: number): Promise<void> {
  logger.error('SHARD', `Shard ${shardId} error: ${error.message}`);
  webhookLogger.logShard('error', shardId, error);
}