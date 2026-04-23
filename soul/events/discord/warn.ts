import logger from '../../console/logger.js';

export const name = 'warn';
export const type = 'discord';

export async function execute(_client: any, warning: string): Promise<void> {
  logger.warn('CLIENT', warning);
}