// soul/commands/info/help.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import {
  buildHelpMenuPayload,
  buildCommandInfoPayload,
  registerHelpSession,
} from '../../components/helpMenu.js';
import { sendError } from '../../components/statusMessages.js';

export const options = {
  name: 'help',
  aliases: ['h'],
  description: 'Shows the Hermaca help menu.',
  usage: `help
  help <command name>`,
  category: 'info',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 2,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const input = args[0]?.toLowerCase();

  if (input) {
    // Resolve name or alias
    const resolvedName: string | undefined = (client.commands as any)?.has(input)
      ? input
      : (client.aliases as any)?.get(input);

    if (!resolvedName) {
      await sendError(message, `No command called \`${input}\` found.`);
      return;
    }

    const payload = await buildCommandInfoPayload(client, resolvedName, message.guild?.id ?? null);
    if (!payload) {
      await sendError(message, `No command called \`${input}\` found.`);
      return;
    }

    await message.channel.send(payload as any);
    return;
  }

  const payload = await buildHelpMenuPayload(client, message.author.id, message.guild?.id ?? null);
  const sent = await message.channel.send(payload as any);

  registerHelpSession(sent.id, {
    page: 'home',
    userId: message.author.id,
    guildId: message.guild?.id ?? null,
    channelId: message.channel.id,
    client,
  });
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }
  const payload = await buildHelpMenuPayload(
    client,
    interaction.user.id,
    interaction.guild?.id ?? null,
  );
  await interaction.editReply(payload as any);

  const reply = await interaction.fetchReply().catch((): null => null);
  if (reply) {
    registerHelpSession(reply.id, {
      page: 'home',
      userId: interaction.user.id,
      guildId: interaction.guild?.id ?? null,
      channelId: interaction.channelId,
      client,
    });
  }
}
