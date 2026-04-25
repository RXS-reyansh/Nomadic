// soul/handlers/eventLoader.ts
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import logger from '../console/logger.js';
import type { HermacaClient } from '../structures/HermacaClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface EventModule {
  name: string;
  type: 'discord' | 'node' | 'player';
  once?: boolean;
  execute: (client: HermacaClient, ...args: any[]) => Promise<void> | void;
}

function getFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getFilesRecursive(fullPath));
      } else if (entry.isFile() && !entry.name.endsWith('.d.ts') && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    logger.error('EVENT LOADER', `Failed to scan directory ${dir}: ${(err as Error).message}`);
  }
  return files;
}

export async function loadAllEvents(client: HermacaClient): Promise<void> {
  const eventsDir = join(__dirname, '../events');

  logger.info('EVENT LOADER', 'Loading events');

  let loadedCount = 0;
  try {
    const eventFiles = getFilesRecursive(eventsDir);

    for (const filePath of eventFiles) {
      try {
        const fileUrl = `file://${filePath}`;
        const module = await import(fileUrl);
        const event: EventModule = module.default || module;

        if (!event.name || !event.type || !event.execute) {
          logger.warn('EVENT LOADER', `Skipping ${filePath}: missing name/type/execute`);
          continue;
        }

        const { name, type, once, execute } = event;
        const handler = (...args: any[]) => execute(client, ...args);

        if (type === 'discord') {
          if (once) client.once(name as any, handler);
          else client.on(name as any, handler);
        } else if (type === 'player') {
          if (!client.kazagumo) {
            logger.error('EVENT LOADER', `Cannot attach player event "${name}": Kazagumo not initialized`);
            continue;
          }
          if (once) client.kazagumo.once(name as any, handler);
          else client.kazagumo.on(name as any, handler);
        } else if (type === 'node') {
          if (!client.kazagumo?.shoukaku) {
            logger.error('EVENT LOADER', `Cannot attach node event "${name}": Shoukaku not initialized`);
            continue;
          }
          if (once) client.kazagumo.shoukaku.once(name as any, handler);
          else client.kazagumo.shoukaku.on(name as any, handler);
        } else {
          logger.warn('EVENT LOADER', `Unknown event type "${type}" in ${filePath}`);
          continue;
        }

        loadedCount++;
      } catch (err) {
        logger.error('EVENT LOADER', `Failed to load ${filePath}: ${(err as Error).message}`);
      }
    }

    logger.info('EVENT LOADER', `${loadedCount} events loaded`);
  } catch (err) {
    logger.error('EVENT LOADER', `Fatal error loading events: ${(err as Error).message}`);
  }
}
