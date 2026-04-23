import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';
import { validate } from '../../handlers/commandValidator.js';
import {
  buildHelpMenuPayload,
  buildAllCommandsPayload,
  buildCategoryPayload,
  helpSessions,
  resetHelpTimeout,
} from '../../components/helpMenu.js';
import {
  buildDebugHomePayload,
  buildDebugAllStatsPayload,
  buildDebugCategoryPayload,
  debugSessions,
  resetDebugTimeout,
} from '../../components/debugMenu.js';
import { blacklistedUser } from '../../components/statusMessages.js';

export const name = 'interactionCreate';
export const type = 'discord';

export async function execute(client: any, interaction: any): Promise<void> {
  // Autocomplete
  if (interaction.isAutocomplete()) {
    const command = client.slashCommands.get(interaction.commandName);
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        logger.error('AUTOCOMPLETE', `${interaction.commandName}: ${(err as Error).message}`);
      }
    }
    return;
  }

  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;

    if (
      await client.db?.getBlacklistGlobalEnabled() &&
      await client.db?.isUserBlacklisted(interaction.user.id)
    ) {
      await blacklistedUser({ interaction }).catch((): null => null);
      return;
    }

    const passed = await validate(
      command.options,
      {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        voiceChannelId: (interaction.member as any)?.voice?.channelId ?? undefined,
      },
      { interaction },
      client,
    );
    if (!passed) return;

    try {
      await command.execute(interaction, client);
      webhookLogger.logCommand(
        interaction.commandName,
        interaction.user,
        interaction.guild,
        [],
        { prefix: '/', type: 'Slash' },
      );
      if (client.db?.incrementGlobalCommandsExecuted) {
        client.db.incrementGlobalCommandsExecuted().catch((): null => null);
      }
    } catch (err) {
      logger.error('SLASH', `${interaction.commandName}: ${(err as Error).message}`);
      const reply = { content: '❌ An error occurred.' };
      if (interaction.deferred || interaction.replied) {
        interaction.editReply(reply).catch((): null => null);
      } else {
        interaction.reply(reply).catch((): null => null);
      }
    }
    return;
  }

  // Select menus
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'help:nav') {
      await interaction.deferUpdate();
      const categoryName = interaction.values[0] as string;

      const session = helpSessions.get(interaction.message.id);
      if (session) {
        session.page = categoryName;
        resetHelpTimeout(interaction.message.id);
      }

      const payload = await buildCategoryPayload(
        client,
        interaction.user.id,
        categoryName,
        interaction.guild?.id ?? null,
      );
      await interaction.editReply(payload as any).catch((): null => null);
      return;
    }

    if (interaction.customId === 'debug:nav') {
      await interaction.deferUpdate();
      const session = debugSessions.get(interaction.message.id);
      if (!session || interaction.user.id !== session.userId) return;

      const category = interaction.values[0] as string;
      session.page = category;
      resetDebugTimeout(interaction.message.id, interaction);

      const payload = buildDebugCategoryPayload(
        session.stats,
        category,
        session.authorUsername,
        session.prefix,
        session.sentAt,
        false,
        client,
      );
      await interaction.editReply(payload as any).catch((): null => null);
      return;
    }
  }

  // Buttons
  if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId === 'help:home') {
      await interaction.deferUpdate();

      const session = helpSessions.get(interaction.message.id);
      if (session) {
        session.page = 'home';
        resetHelpTimeout(interaction.message.id);
      }

      const payload = await buildHelpMenuPayload(
        client,
        interaction.user.id,
        interaction.guild?.id ?? null,
      );
      await interaction.editReply(payload as any).catch((): null => null);
      return;
    }

    if (customId === 'help:allcommands') {
      await interaction.deferUpdate();

      const session = helpSessions.get(interaction.message.id);
      if (session) {
        session.page = 'allcommands';
        resetHelpTimeout(interaction.message.id);
      }

      const payload = await buildAllCommandsPayload(
        client,
        interaction.user.id,
        interaction.guild?.id ?? null,
      );
      await interaction.editReply(payload as any).catch((): null => null);
      return;
    }

    if (customId === 'debug:home') {
      await interaction.deferUpdate();
      const session = debugSessions.get(interaction.message.id);
      if (!session || interaction.user.id !== session.userId) return;

      session.page = 'home';
      resetDebugTimeout(interaction.message.id, interaction);

      const payload = buildDebugHomePayload(
        session.stats,
        session.authorUsername,
        session.prefix,
        session.sentAt,
        false,
        client,
      );
      await interaction.editReply(payload as any).catch((): null => null);
      return;
    }

    if (customId === 'debug:allstats') {
      await interaction.deferUpdate();
      const session = debugSessions.get(interaction.message.id);
      if (!session || interaction.user.id !== session.userId) return;

      session.page = 'allstats';
      resetDebugTimeout(interaction.message.id, interaction);

      const payload = buildDebugAllStatsPayload(
        session.stats,
        session.authorUsername,
        session.prefix,
        session.sentAt,
        false,
        client,
      );
      await interaction.editReply(payload as any).catch((): null => null);
      return;
    }

    if (client.helpers?.handleMusicButton) {
      await client.helpers.handleMusicButton(interaction).catch((err: Error) => {
        logger.error('BUTTON', err.message);
      });
    }
  }
}
