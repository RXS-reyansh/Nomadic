import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'shardDisconnect';
export const type = 'discord';

export async function execute(_client: any, shardId: number): Promise<void> {
  logger.warn('SHARD', `Shard ${shardId} disconnected`);
  webhookLogger.logShard('disconnect', shardId);
}