// soul/components/statusMessages.ts
import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  type Message,
  type ChatInputCommandInteraction,
  type TextBasedChannel,
} from 'discord.js';
import { emojis } from '../emojis.js';

export interface StatusContext {
  interaction?: ChatInputCommandInteraction;
  message?: Message;
  channel?: TextBasedChannel;
  existingMessage?: Message;
  reply?: boolean;
  mention?: boolean;
  asReply?: boolean;
}

const NO_MENTIONS = { parse: [] as any[] };

async function sendStatus(context: StatusContext, formattedContent: string): Promise<Message | void> {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedContent),
  );

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  } as any;

  // ── Interaction path ───────────────────────────────────────────────────────
  if (context.interaction) {
    const interaction = context.interaction;

    if (context.asReply === false) {
      return await (interaction.channel as any).send(payload);
    }

    if (interaction.deferred || interaction.replied) {
      return (await interaction.editReply(payload)) as Message;
    }

    return (await interaction.reply({ ...payload, fetchReply: true })) as unknown as Message;
  }

  // ── Raw channel path ───────────────────────────────────────────────────────
  if (context.channel) {
    return await (context.channel as any).send(payload);
  }

  // ── Prefix message path ───────────────────────────────────────────────────
  if (context.message) {
    if (context.existingMessage?.editable) {
      return await context.existingMessage.edit(payload);
    }

    if (context.reply === false) {
      return await (context.message.channel as any).send(payload);
    }

    return await context.message.reply({
      ...payload,
      allowedMentions: { repliedUser: context.mention ?? false },
    });
  }

  throw new Error('StatusContext must include interaction, channel, or message.');
}

export async function sendSuccess(context: StatusContext, content: string) {
  return sendStatus(context, `${emojis.blacktick} ${content}`);
}
export async function sendError(context: StatusContext, content: string) {
  return sendStatus(context, `${emojis.redcross} ${content}`);
}
export async function sendInfo(context: StatusContext, content: string) {
  return sendStatus(context, `${emojis.info} ${content}`);
}
export async function sendLoading(context: StatusContext, content: string) {
  return sendStatus(context, `${emojis.loading} ${content}`);
}
/**
 * Send a "note" message via Components V2 to a specific channel.
 * Used by the dev-only `note` command. Caller is responsible for sending
 * the divider message afterwards (config.noteDivider).
 *
 * Layout:
 *   ### {sabrinaTaste} __To {KEYWORD}:__
 *   {body}
 */
export async function sendNote(
  channel: TextBasedChannel,
  keyword: string,
  body: string,
  imageUrl?: string | null,
): Promise<Message | void> {
  const upper = keyword.toUpperCase();
  const headerLabel = keyword.toLowerCase() === 'other' ? 'Stupid note' : `To ${upper}`;
  const content = `### ${emojis.sabrinaTaste} __${headerLabel}:__\n${body}`;

  // Lazy-import the gallery builders so this file stays tree-shakeable.
  const { MediaGalleryBuilder, MediaGalleryItemBuilder } = await import('discord.js');

  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(content),
  );
  if (imageUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)),
    );
  }
  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: NO_MENTIONS,
  } as any;
  return await (channel as any).send(payload);
}

export async function reservedForDeveloper(context: StatusContext) {
  return sendStatus(context, `${emojis.blackcrown} This command is reserved for developers only.`);
}

export async function blacklistedUser(context: StatusContext) {
  return sendStatus(
    context,
    `## ${emojis.SabrinaFU} You have been blacklisted from using this bot for some stupidity you indulged in. Kindly fuck off.`,
  );
}

export async function blacklistedServer(context: StatusContext, guild: any, client: any) {
  const devId: string | undefined = client.config?.developers?.[0]?.[1];
  const devUser = devId ? await (client.users.fetch(devId) as Promise<any>).catch((): null => null) : null;
  const developerName = devUser ? `@${devUser.username}` : (client.config?.developers?.[0]?.[0] ?? 'the developer');
  const supportServer = client.config?.supportServer ?? '';
  const supportLine = supportServer ? `- [Support server](${supportServer})` : '- Support server';
  const ownerId = guild?.ownerId;
  const ownerLine = ownerId ? `<@${ownerId}>` : 'Server owner';
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${ownerLine} This server has been blacklisted from using this bot. For help, kindly refer to:\n- ${developerName}\n${supportLine}`,
    ),
  );

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: ownerId ? { users: [ownerId] } : NO_MENTIONS,
  } as any;

  if (context.interaction) {
    const interaction = context.interaction;
    if (interaction.deferred || interaction.replied) {
      return (await interaction.editReply(payload)) as Message;
    }
    return (await interaction.reply({ ...payload, fetchReply: true })) as unknown as Message;
  }

  if (context.channel) {
    return await (context.channel as any).send(payload);
  }

  if (context.message) {
    if (context.reply === false) {
      return await (context.message.channel as any).send(payload);
    }
    return await context.message.reply(payload);
  }

  throw new Error('StatusContext must include interaction, channel, or message.');
}
