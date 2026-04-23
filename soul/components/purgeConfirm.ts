// soul/components/purgeConfirm.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';

function buildPayload(
  confirmId: string,
  cancelId: string,
  description: string,
  footer: string,
  disabled: boolean,
): any {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## Confirm purge'),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${description}\n**This action is irreversible.**`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(confirmId)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(cancelId)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(footer),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

/** Active confirmation prompt with live buttons. */
export function buildPurgeConfirmPayload(
  confirmId: string,
  cancelId: string,
  description: string,
): any {
  return buildPayload(confirmId, cancelId, description, '-# You have 30 seconds to decide.', false);
}

/** Timed-out state — buttons disabled, footer updated. */
export function buildPurgeTimedOutPayload(
  confirmId: string,
  cancelId: string,
  description: string,
): any {
  return buildPayload(confirmId, cancelId, description, '-# Confirmation timed out.', true);
}

/** Cancelled state — buttons disabled, footer updated. */
export function buildPurgeCancelledPayload(
  confirmId: string,
  cancelId: string,
  description: string,
): any {
  return buildPayload(confirmId, cancelId, description, '-# Purge cancelled.', true);
}
