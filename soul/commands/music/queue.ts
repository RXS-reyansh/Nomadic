// soul/commands/music/queue.ts
//
// Show the full session queue (completed + now playing + upcoming) with
// pagination and a jump-to dropdown. See `soul/components/queueMenu.ts` for
// the renderer and `soul/helpers/sessionQueue.ts` for the data model.

import { ContainerBuilder, MessageFlags, TextDisplayBuilder } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { emojis } from '../../emojis.js';
import {
  buildQueuePayload,
  pageForCurrent,
  registerQueueSession,
  type QueueMenuSession,
} from '../../components/queueMenu.js';

export const options = {
  name: 'queue',
  aliases: ['q', 'list'] as string[],
  description: 'Show the full queue: completed, now playing, and upcoming.',
  usage: 'queue [page]',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean; channel: any; user: any; guildId: string },
  startPage: number | null,
  client: HermacaClient,
): Promise<void> {
  const player = client.kazagumo.players.get(ctx.guildId);

  const prefix: string = ctx.guildId
    ? ((await (client.helpers as any)?.getGuildPrefix?.(ctx.guildId).catch((): null => null)) ?? client.config.prefix)
    : client.config.prefix;

  const page = startPage && startPage > 0 ? startPage : pageForCurrent(player);

  const session: QueueMenuSession = {
    guildId: ctx.guildId,
    channelId: ctx.channel.id,
    userId: ctx.user.id,
    authorUsername: ctx.user.username,
    prefix,
    page,
    client,
  };

  const payload = buildQueuePayload(player, session, false);

  let sent: any;
  if (ctx.isSlash) {
    if (!ctx.interaction.deferred && !ctx.interaction.replied) {
      await ctx.interaction.deferReply();
    }
    sent = await ctx.interaction.editReply(payload as any);
  } else {
    // Show a brief loading container first for parity with debug.
    const loading = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${emojis.loading} Loading queue…`),
    );
    sent = await ctx.message.channel.send({
      components: [loading],
      flags: MessageFlags.IsComponentsV2,
    });
    await sent.edit(payload as any);
  }

  if (sent?.id) registerQueueSession(sent.id, session);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const startPage = args[0] ? parseInt(args[0], 10) : null;
  await handle(
    {
      message,
      isSlash: false,
      channel: message.channel,
      user: message.author,
      guildId: message.guild.id,
    },
    isNaN(startPage as any) ? null : startPage,
    client,
  );
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  const startPage = interaction.options.getInteger('page');
  await handle(
    {
      interaction,
      isSlash: true,
      channel: interaction.channel,
      user: interaction.user,
      guildId: interaction.guild.id,
    },
    startPage,
    client,
  );
}
