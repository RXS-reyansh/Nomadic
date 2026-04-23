// aether/handlers/commandLoader.ts
import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'node:url';
import { HermacaClient } from '../structures/HermacaClient.js';
import logger from '../console/logger.js';

interface CommandOptions {
  name: string;
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

interface PrefixCommandModule {
  options: CommandOptions;
  prefixExecute: (message: any, args: string[], client: HermacaClient) => Promise<void> | void;
}

interface LoadStats {
  loaded: number;
  skipped: number;
}

export async function loadPrefixCommands(client: HermacaClient): Promise<void> {
  const commandsPath = join(process.cwd(), 'dist', 'soul', 'commands');
  const stats: LoadStats = { loaded: 0, skipped: 0 };

  try {
    await loadCommandsRecursive(client, commandsPath, stats);
    logger.success('COMMANDS', `Loaded ${stats.loaded} prefix commands (${stats.skipped} skipped)`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('COMMANDS', `Failed to load prefix commands: ${error}`);
    }
  }
}

async function loadCommandsRecursive(
  client: HermacaClient,
  dirPath: string,
  stats: LoadStats
): Promise<void> {
  const files = readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = join(dirPath, file.name);

    if (file.isDirectory()) {
      await loadCommandsRecursive(client, filePath, stats);
    } else if (file.name.endsWith('.js')) {
      try {
        const module = await import(pathToFileURL(filePath).href);
        const command: PrefixCommandModule = module.default || module;

        // Validate required fields
        if (!command.options?.name || !command.options?.description || !command.options?.category || command.options?.usage === undefined) {
          logger.warn('COMMANDS', `Skipping ${file.name}: missing required options`);
          stats.skipped++;
          continue;
        }

        if (typeof command.prefixExecute !== 'function') {
          logger.warn('COMMANDS', `Skipping ${file.name}: prefixExecute is not a function`);
          stats.skipped++;
          continue;
        }

        const commandName = command.options.name.toLowerCase();
        client.commands.set(commandName, command);
        stats.loaded++;

        // Register aliases
        if (command.options.aliases) {
          for (const alias of command.options.aliases) {
            client.aliases.set(alias.toLowerCase(), commandName);
          }
        }

        logger.debug('COMMANDS', `Loaded prefix: ${command.options.category}/${commandName}`);
      } catch (error) {
        logger.error('COMMANDS', `Failed to load ${file.name}: ${error}`);
        stats.skipped++;
      }
    }
  }
}