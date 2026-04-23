import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'shardReady';
export const type = 'discord';

export async function execute(_client: any, shardId: number): Promise<void> {
  logger.success('SHARD', `Shard ${shardId} ready`);
  webhookLogger.logShard('ready', shardId);
}