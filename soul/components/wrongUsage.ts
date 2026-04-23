// aether/components/wrongUsage.ts
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  type Message,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { HermacaClient } from '../structures/HermacaClient.js';

interface WrongUsageContext {
  interaction?: ChatInputCommandInteraction;
  message?: Message;
  existingMessage?: Message;
  client?: HermacaClient;
}

export async function sendWrongUsage(
  context: WrongUsageContext,
  commandName: string,
  usage: string,
  footer: string = '-# Use {prefix}help to see all commands.',
): Promise<Message | void> {
  let resolvedFooter = footer;
  if (context.client) {
    resolvedFooter = footer.replace(/\{prefix\}/g, context.client.config.prefix);
  }

  const usageLines = usage.split('\n').map(l => l.trim()).filter(l => l);
  const bulletLines = usageLines.map(l => `- ${l}`).join('\n');

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Wrong usage`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### Correct usage of \`${commandName}\` is:`),
      new TextDisplayBuilder().setContent(bulletLines),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(resolvedFooter));

  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  } as any; // Bypass incomplete Discord.js types

  if (context.interaction) {
    const interaction = context.interaction;
    if (interaction.deferred || interaction.replied) {
      return (await interaction.editReply(payload)) as Message;
    } else {
      return (await interaction.reply({ ...payload, fetchReply: true })) as unknown as Message;
    }
  }

  if (context.message) {
    const target = context.existingMessage || context.message;
    if (target.editable) {
      return await target.edit(payload);
    } else {
      return await (context.message.channel as any).send(payload);
    }
  }

  throw new Error('Invalid context');
}