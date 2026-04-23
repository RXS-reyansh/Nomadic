// soul/components/avatarBanner.ts
//
// Components V2 builders for the server-vs-global choice prompt used by
// the avatar and banner commands.
//
// The image display panel (with "Send in DM" + "Download") lives in
// soul/helpers/imagePanel.ts so it can be reused across any command.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';

export type MediaType = 'avatar' | 'banner';

// ─── Active choice prompt ─────────────────────────────────────────────────────

export function buildChoicePayload(displayName: string, type: MediaType): any {
  const label = type === 'avatar' ? 'Avatar' : 'Banner';

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Choose ${label}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${displayName}** has a server-specific ${label.toLowerCase()}. Which one would you like to see?`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`choice:server_${type}`)
          .setLabel(`Server ${label}`)
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`choice:global_${type}`)
          .setLabel(`Global ${label}`)
          .setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# You have 60 seconds to decide.'),
    );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ─── Timed-out choice prompt ──────────────────────────────────────────────────

export function buildTimedOutChoicePayload(displayName: string, type: MediaType): any {
  const label = type === 'avatar' ? 'Avatar' : 'Banner';

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# Choose ${label}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${displayName}** has a server-specific ${label.toLowerCase()}. Which one would you like to see?`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`choice:server_${type}`)
          .setLabel(`Server ${label}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`choice:global_${type}`)
          .setLabel(`Global ${label}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# Confirmation timed out.'),
    );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
