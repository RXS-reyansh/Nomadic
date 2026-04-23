import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

export function buildNoprefixListPayload(
  title: string,
  lines: string[],
  totalLabel: string,
  emptyMessage?: string,
) {
  const body = lines.length
    ? lines.map((line) => `- ${line}`).join('\n')
    : (emptyMessage ?? 'Nothing to show.');

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${emojis.bloodRip} ${title}`))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${totalLabel}: ${lines.length}`));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}
