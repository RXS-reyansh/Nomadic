import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'shardResume';
export const type = 'discord';

export async function execute(_client: any, shardId: number, replayed: number): Promise<void> {
  logger.success('SHARD', `Shard ${shardId} resumed (replayed ${replayed})`);
  webhookLogger.logShard('resume', shardId);
}