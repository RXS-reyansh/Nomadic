// aether/handlers/slashLoader.ts
import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'node:url';
import { HermacaClient } from '../structures/HermacaClient.js';
import logger from '../console/logger.js';

interface CommandOptions {
  name: string;
  slashName?: string;
  description: string;
  category: string;
  usage: string;
  aliases?: string[];
  owner?: boolean;
  userPerms?: string[];
  botPerms?: string[];
  player?: boolean;
  inVoiceChannel?: boolean;
  sameVoiceChannel?: boolean;
  cooldown?: number;
}

interface SlashCommandModule {
  options: CommandOptions;
  slashExecute: (interaction: any, client: HermacaClient) => Promise<void> | void;
}

interface LoadStats {
  loaded: number;
  skipped: number;
}

export async function loadSlashCommands(client: HermacaClient): Promise<void> {
  const commandsPath = join(process.cwd(), 'dist', 'soul', 'commands');
  const stats: LoadStats = { loaded: 0, skipped: 0 };

  try {
    await loadSlashRecursive(client, commandsPath, stats);
    logger.info('SLASH LOADER', `Loaded ${stats.loaded} slash executables (${stats.skipped} skipped)`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('SLASH LOADER', `Failed to load slash commands: ${error}`);
    }
  }
}

async function loadSlashRecursive(
  client: HermacaClient,
  dirPath: string,
  stats: LoadStats
): Promise<void> {
  const files = readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = join(dirPath, file.name);

    if (file.isDirectory()) {
      await loadSlashRecursive(client, filePath, stats);
    } else if (file.name.endsWith('.js')) {
      try {
        const module = await import(pathToFileURL(filePath).href);
        const command: SlashCommandModule = module.default || module;

        if (!command.options?.name) {
          logger.warn('SLASH LOADER', `Skipping ${file.name}: missing options.name`);
          stats.skipped++;
          continue;
        }

        if (typeof command.slashExecute !== 'function') {
          // Not every command needs a slash version; skip silently
          continue;
        }

        const commandName = (command.options.slashName ?? command.options.name).toLowerCase();
        client.slashCommands.set(commandName, {
          options: command.options,
          execute: command.slashExecute,
        });
        stats.loaded++;

        logger.debug('SLASH LOADER', `Loaded executable: ${command.options.category}/${commandName}`);
      } catch (error) {
        logger.error('SLASH LOADER', `Failed to load ${file.name}: ${error}`);
        stats.skipped++;
      }
    }
  }
}