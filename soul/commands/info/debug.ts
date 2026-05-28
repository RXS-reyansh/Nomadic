// soul/commands/info/debug.ts
//
// Display a detailed multi-page stats menu for the bot.
// Available to everyone — useful for users to inspect bot health themselves.
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
  aliases: ['botstats'] as string[],
  description: 'Display a detailed multi-page stats menu for the bot.',
  usage: 'debug',
  category: 'info',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

async function resolvePrefix(message: any, client: HermacaClient): Promise<string> {
  return message.guild
    ? ((await (client.helpers as any)?.getGuildPrefix?.(message.guild.id).catch((): null => null)) ?? client.config.prefix)
    : client.config.prefix;
}

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

  const prefix = await resolvePrefix(message, client);
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

export async function slashExecute(interaction: any, client: HermacaClient) {
  const before = Date.now();
  await interaction.reply({
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${emojis.loading} Gathering stats…`),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
  const apiMs = Date.now() - before;

  const sent = await interaction.fetchReply();

  const prefix: string = interaction.guild
    ? ((await (client.helpers as any)?.getGuildPrefix?.(interaction.guild.id).catch((): null => null)) ?? client.config.prefix)
    : client.config.prefix;

  const stats = await gatherDebugStats(client, apiMs);

  const sentAt = formatSentAt();
  const payload = buildDebugHomePayload(stats, interaction.user.username, prefix, sentAt, false, client);
  await interaction.editReply(payload as any);

  const session: DebugSession = {
    page: 'home',
    stats,
    userId: interaction.user.id,
    authorUsername: interaction.user.username,
    channelId: interaction.channel?.id ?? interaction.channelId,
    prefix,
    sentAt,
    client,
  };

  registerDebugSession(sent.id, session);
}
