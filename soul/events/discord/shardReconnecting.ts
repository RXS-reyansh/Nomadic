import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'shardReconnecting';
export const type = 'discord';

export async function execute(_client: any, shardId: number): Promise<void> {
  logger.info('SHARD', `Shard ${shardId} reconnecting`);
  webhookLogger.logShard('reconnecting', shardId);
}