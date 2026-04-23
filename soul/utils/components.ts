import {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  type Message,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
} from 'discord.js';

// ------------------------------------------------------------
// Type guard for channels that can send messages
// ------------------------------------------------------------
function isSendableChannel(channel: any): channel is TextBasedChannel {
  return channel && typeof channel.send === 'function';
}

// ------------------------------------------------------------
// Core sending function – handles all contexts and options
// ------------------------------------------------------------
interface SendComponentOptions {
  /** If true, send as a reply to the original message (only works with `message` context) */
  reply?: boolean;
  /** If replying, whether to mention the original author (default: true) */
  mention?: boolean;
}

export async function sendComponent(
  ctx: { interaction?: ChatInputCommandInteraction; message?: Message },
  components: any[],
  flags: number = MessageFlags.IsComponentsV2,
  options: SendComponentOptions = {}
) {
  const payload = { components, flags };

  // ---------- Interaction context ----------
  if (ctx.interaction) {
    const interaction = ctx.interaction;
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(payload as any);
    }
    return interaction.reply({ ...payload, fetchReply: true } as any);
  }

  // ---------- Message context ----------
  if (ctx.message) {
  const { reply = false, mention = true } = options;

  if (reply) {
    const replyOptions: any = { ...payload };
    if (!mention) {
      replyOptions.allowedMentions = { repliedUser: false };
    }
    return ctx.message.reply(replyOptions);
  } else {
    // ✅ Use Discord.js's built-in isSendable() method
    if (ctx.message.channel.isSendable()) {
      return ctx.message.channel.send(payload as any);
    }
    throw new Error('Cannot send Components V2 to this channel type');
  }
}

  throw new Error('Invalid context: neither interaction nor message provided');
}

// ------------------------------------------------------------
// Convenience wrappers for common patterns
// ------------------------------------------------------------
export async function sendComponentReply(
  ctx: { interaction?: ChatInputCommandInteraction; message?: Message },
  components: any[],
  mention = true
) {
  return sendComponent(ctx, components, MessageFlags.IsComponentsV2, { reply: true, mention });
}

export async function sendComponentToChannel(
  ctx: { message: Message },
  components: any[]
) {
  return sendComponent(ctx, components, MessageFlags.IsComponentsV2, { reply: false });
}

// ------------------------------------------------------------
// Builder shortcuts (same as before)
// ------------------------------------------------------------
export function heading(level: 1 | 2 | 3, text: string) {
  const prefix = '#'.repeat(level);
  return new TextDisplayBuilder().setContent(`${prefix} ${text}`);
}

export function markdown(text: string) {
  return new TextDisplayBuilder().setContent(text);
}

export function separator(divider: boolean = true, spacing?: 'small' | 'large') {
  const builder = new SeparatorBuilder().setDivider(divider);
  if (spacing) builder.setSpacing(spacing as any);
  return builder;
}

export function container(accentColor?: number) {
  const c = new ContainerBuilder();
  if (accentColor) c.setAccentColor(accentColor);
  return c;
}

export function section(...textComponents: TextDisplayBuilder[]) {
  const s = new SectionBuilder();
  for (const t of textComponents) s.addTextDisplayComponents(t);
  return s;
}

export function sectionWithThumbnail(thumbnailUrl: string, ...textComponents: TextDisplayBuilder[]) {
  const s = section(...textComponents);
  s.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl));
  return s;
}

export function primaryButton(customId: string, label: string, emoji?: string) {
  const btn = new ButtonBuilder().setStyle(ButtonStyle.Primary).setCustomId(customId).setLabel(label);
  if (emoji) btn.setEmoji(emoji);
  return btn;
}

export function dangerButton(customId: string, label: string) {
  return new ButtonBuilder().setStyle(ButtonStyle.Danger).setCustomId(customId).setLabel(label);
}

export function linkButton(url: string, label: string) {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(label);
}

export function actionRow(...buttons: ButtonBuilder[]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}