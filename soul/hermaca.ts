// aether/hermaca.ts
import { HermacaClient } from './structures/HermacaClient.js';
import logger from './console/logger.js';
import { getHostingServiceIP } from './helpers/getHostingServiceIP.js';

async function bootstrap() {
  await getHostingServiceIP();

  const client = new HermacaClient();

  try {
    await client.loadModules();
    await client.login();
    logger.success('YAY!', 'Bot fully initialized and ready!');
    logger.line();
    return client;
  } catch (error) {
    logger.error('BOOTSTRAP', `Failed to start: ${(error as Error).message}`);
    process.exit(1);
  }
}

export default await bootstrap();
