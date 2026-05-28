import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
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
import {
  buildQueuePayload,
  queueSessions,
  resetQueueTimeout,
} from '../../components/queueMenu.js';
import { jumpTo } from '../../helpers/sessionQueue.js';
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

    // Blacklist gate — developers ALWAYS bypass, and any stale blacklist
    // entry for a developer is auto-cleaned (self-healing for accidental
    // self-blacklists predating the dev-guard in the blacklist command).
    {
      const developerIds: string[] = client.config.developers.map((dev: string[]) => dev[1]);
      const isDev = developerIds.includes(interaction.user.id);
      if (
        await client.db?.getBlacklistGlobalEnabled() &&
        await client.db?.isUserBlacklisted(interaction.user.id)
      ) {
        if (isDev) {
          await client.db.removeBlacklistedUser(interaction.user.id).catch((): null => null);
        } else {
          await blacklistedUser({ interaction }).catch((): null => null);
          return;
        }
      }
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

    if (interaction.customId === 'queue:jump') {
      const session = queueSessions.get(interaction.message.id);
      if (!session) {
        await interaction.deferUpdate().catch((): null => null);
        return;
      }
      if (interaction.user.id !== session.userId) {
        await interaction.reply({
          content: 'Only the user who opened this queue can jump tracks.',
          ephemeral: true,
        }).catch((): null => null);
        return;
      }

      const player = client.kazagumo.players.get(session.guildId);
      if (!player) {
        await interaction.reply({
          content: 'There is no active player in this server.',
          ephemeral: true,
        }).catch((): null => null);
        return;
      }

      const memberVoiceId = (interaction.member as any)?.voice?.channelId;
      if (!memberVoiceId || memberVoiceId !== player.voiceId) {
        await interaction.reply({
          content: 'You must be in the same voice channel as the bot to jump tracks.',
          ephemeral: true,
        }).catch((): null => null);
        return;
      }

      await interaction.deferUpdate();
      const target = parseInt(interaction.values[0] as string, 10);
      if (!isNaN(target)) await jumpTo(player, target);

      resetQueueTimeout(interaction.message.id);
      const payload = buildQueuePayload(player, session, false);
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

    // ─────── Queue command — Page (goto) button opens a modal ───────
    if (customId === 'queue:goto') {
      const session = queueSessions.get(interaction.message.id);
      if (!session) {
        await interaction.deferUpdate().catch((): null => null);
        return;
      }
      if (interaction.user.id !== session.userId) {
        await interaction.reply({
          content: 'Only the user who opened this queue can navigate it.',
          ephemeral: true,
        }).catch((): null => null);
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`queue:goto-modal:${interaction.message.id}`)
        .setTitle('Jump to page')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('page')
              .setLabel('Page number')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(5)
              .setPlaceholder('e.g. 3'),
          ),
        );

      await interaction.showModal(modal).catch((): null => null);
      return;
    }

    // ─────── Queue command — pagination + refresh ───────
    if (customId === 'queue:prev' || customId === 'queue:next' || customId === 'queue:refresh') {
      const session = queueSessions.get(interaction.message.id);
      if (!session) {
        await interaction.deferUpdate().catch((): null => null);
        return;
      }
      if (interaction.user.id !== session.userId) {
        await interaction.reply({
          content: 'Only the user who opened this queue can navigate it.',
          ephemeral: true,
        }).catch((): null => null);
        return;
      }

      await interaction.deferUpdate();
      if (customId === 'queue:prev') session.page = Math.max(1, session.page - 1);
      else if (customId === 'queue:next') session.page = session.page + 1;
      // 'queue:refresh' just re-renders the current page.

      resetQueueTimeout(interaction.message.id);
      const player = client.kazagumo.players.get(session.guildId);
      const payload = buildQueuePayload(player, session, false);
      await interaction.editReply(payload as any).catch((): null => null);
      return;
    }

    if (client.helpers?.handleMusicButton) {
      await client.helpers.handleMusicButton(interaction).catch((err: Error) => {
        logger.error('BUTTON', err.message);
      });
    }
  }

  // Modal submissions
  if (interaction.isModalSubmit()) {
    // queue:goto-modal:<messageId> — jump to a specific page in the queue panel
    if (interaction.customId.startsWith('queue:goto-modal:')) {
      const messageId = interaction.customId.slice('queue:goto-modal:'.length);
      const session = queueSessions.get(messageId);
      if (!session) {
        await interaction.reply({
          content: 'This queue panel is no longer active.',
          ephemeral: true,
        }).catch((): null => null);
        return;
      }
      if (interaction.user.id !== session.userId) {
        await interaction.reply({
          content: 'Only the user who opened this queue can navigate it.',
          ephemeral: true,
        }).catch((): null => null);
        return;
      }

      const raw = interaction.fields.getTextInputValue('page').trim();
      const page = parseInt(raw, 10);
      if (!Number.isFinite(page) || page < 1) {
        await interaction.reply({
          content: `\`${raw}\` is not a valid page number.`,
          ephemeral: true,
        }).catch((): null => null);
        return;
      }

      session.page = page; // buildQueuePayload clamps to [1, totalPages]
      resetQueueTimeout(messageId);

      const player = client.kazagumo.players.get(session.guildId);
      const payload = buildQueuePayload(player, session, false);

      // ModalSubmit doesn't reference the original message — fetch and edit it.
      try {
        const channel = await client.channels.fetch(session.channelId);
        const msg = await (channel as any).messages.fetch(messageId);
        await msg.edit(payload);
        await interaction.deferUpdate().catch((): null => null);
      } catch (err) {
        await interaction.reply({
          content: 'Failed to update the queue panel.',
          ephemeral: true,
        }).catch((): null => null);
      }
      return;
    }
  }
}
