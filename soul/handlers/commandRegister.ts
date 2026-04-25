// aether/handlers/commandRegister.ts
import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'node:url';
import { Routes, SlashCommandBuilder } from 'discord.js';
import { HermacaClient } from '../structures/HermacaClient.js';
import logger from '../console/logger.js';

interface SlashBuilderModule {
  data: SlashCommandBuilder;
}

export async function registerSlashCommands(client: HermacaClient): Promise<void> {
  if (!client.application?.id) {
    logger.error('SLASH', 'Cannot register: application ID not available');
    return;
  }

  const buildersPath = join(process.cwd(), 'dist', 'soul', 'slashCommands');
  const builders: SlashCommandBuilder[] = [];

  try {
    await collectBuilders(buildersPath, builders);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('SLASH', `Failed to collect slash builders: ${error}`);
      return;
    }
  }

  if (builders.length === 0) {
    logger.warn('SLASH', 'No slash command builders found to register');
    return;
  }

  logger.info('SLASH', `ℹ️ Registering slash commands globally...`);

  try {
    const route = Routes.applicationCommands(client.application.id);
    await client.rest.put(route, { body: builders.map(b => b.toJSON()) });
    logger.info('SLASH', `Registered ${builders.length} global slash commands`);
    (client as any).slashCommandsSynced = true;
  } catch (error) {
    logger.error('SLASH', `Failed to register slash commands: ${error}`);
    (client as any).slashCommandsSynced = false;
  }
}

async function collectBuilders(dirPath: string, builders: SlashCommandBuilder[]): Promise<void> {
  const files = readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = join(dirPath, file.name);

    if (file.isDirectory()) {
      await collectBuilders(filePath, builders);
    } else if (file.name.endsWith('.js')) {
      try {
        const module = await import(pathToFileURL(filePath).href);
        const builderModule: SlashBuilderModule = module.default || module;

        if (!builderModule.data || !(builderModule.data instanceof SlashCommandBuilder)) {
          logger.warn('SLASH', `Skipping ${file.name}: missing or invalid SlashCommandBuilder`);
          continue;
        }

        builders.push(builderModule.data);
        logger.debug('SLASH', `Collected builder: ${builderModule.data.name}`);
      } catch (error) {
        logger.error('SLASH', `Failed to load builder ${file.name}: ${error}`);
      }
    }
  }
}
