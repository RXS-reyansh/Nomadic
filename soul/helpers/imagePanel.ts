// soul/helpers/imagePanel.ts
//
// Reusable helper for sending an image panel with "Send in DM" + "Download" buttons.
//
// Usage:
//   await sendImagePanel({ channel, sendAsReply, title, imageUrl, requesterId });
//
// • sendAsReply — pass `(payload) => interaction.editReply(payload)` for slash commands,
//                 or `null` to send directly to `channel`.
// • The "Send in DM" button becomes disabled after 5 minutes.
// • The "Download" button is a permanent link button that always works.
// • DM sends the full component panel (title + image + Download only, no DM button).

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

// ─── Payload builders ─────────────────────────────────────────────────────────

function buildPayload(title: string, imageUrl: string, dmCustomId: string, disabled = false): any {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${emojis.blackButterfly} ${title}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(disabled ? 'img_panel_dm_disabled' : dmCustomId)
          .setLabel('Send in DM')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setLabel('Download')
          .setStyle(ButtonStyle.Link)
          .setURL(imageUrl),
      ),
    );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

/** Panel sent to DMs: same title + image, but only the Download button (no DM button). */
function buildDmPayload(title: string, imageUrl: string): any {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${emojis.blackButterfly} ${title}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Download')
          .setStyle(ButtonStyle.Link)
          .setURL(imageUrl),
      ),
    );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// ─── Main helper ──────────────────────────────────────────────────────────────

export interface ImagePanelOptions {
  channel: any;
  sendAsReply: ((payload: any) => Promise<any>) | null;
  title: string;
  imageUrl: string;
  requesterId: string;
  idPrefix?: string;
}

export async function sendImagePanel(opts: ImagePanelOptions): Promise<void> {
  const { channel, sendAsReply, title, imageUrl, requesterId } = opts;
  const prefix = opts.idPrefix ?? 'img';
  const dmCustomId = `${prefix}_dm_${requesterId}_${Date.now()}`;

  const payload = buildPayload(title, imageUrl, dmCustomId);

  let msg: any;
  if (sendAsReply) {
    msg = await sendAsReply(payload);
  } else {
    msg = await channel.send(payload);
  }

  if (!msg) return;

  const collector = msg.createMessageComponentCollector({
    filter: (i: any) => i.customId === dmCustomId && i.user.id === requesterId,
    time: 5 * 60 * 1000,
    max: 1,
  });

  collector.on('collect', async (i: any) => {
    await i.deferUpdate();
    try {
      await i.user.send(buildDmPayload(title, imageUrl));
      await i.followUp({
        content: `${emojis.blacktick} Sent to your DMs!`,
        ephemeral: true,
      }).catch(() => {});
    } catch {
      await i.followUp({
        content: `${emojis.redcross} Could not send DM. Make sure your DMs are open.`,
        ephemeral: true,
      }).catch(() => {});
    }
  });

  collector.on('end', async (_: any, reason: string) => {
    if (reason === 'time') {
      await msg.edit(buildPayload(title, imageUrl, dmCustomId, true)).catch(() => {});
    }
  });
}
