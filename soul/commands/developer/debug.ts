// soul/commands/developer/debug.ts
import { ContainerBuilder, MessageFlags, TextDisplayBuilder } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { emojis } from '../../emojis.js';
import { gatherDebugStats } from '../../helpers/debugStats.js';
import {
  buildDebugHomePayload,
  formatSentAt,
  registerDebugSession,
  type DebugSession,
} from '../../components/debugMenu.js';

export const options = {
  name: 'debug',
  aliases: [] as string[],
  description: "Display a detailed multi-page stats menu for the bot (developer only).",
  usage: 'debug',
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  const loadingContainer = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${emojis.loading} Gathering stats…`),
  );

  const before = Date.now();
  const sent = await message.channel.send({
    components: [loadingContainer],
    flags: MessageFlags.IsComponentsV2,
  });
  const apiMs = Date.now() - before;

  const prefix: string = message.guild
    ? ((await (client.helpers as any)?.getGuildPrefix?.(message.guild.id).catch((): null => null)) ?? client.config.prefix)
    : client.config.prefix;

  const stats = await gatherDebugStats(client, apiMs);

  const sentAt = formatSentAt();
  const payload = buildDebugHomePayload(stats, message.author.username, prefix, sentAt, false, client);
  await sent.edit(payload as any);

  const session: DebugSession = {
    page: 'home',
    stats,
    userId: message.author.id,
    authorUsername: message.author.username,
    channelId: message.channel.id,
    prefix,
    sentAt,
    client,
  };

  registerDebugSession(sent.id, session);
}
