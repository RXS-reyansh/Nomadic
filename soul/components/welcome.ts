// soul/components/welcome.ts
//
// Components V2 welcome card sent by `guildCreate` whenever the bot
// joins a new guild. Mentions the guild owner and uses a handful of
// emojis from `soul/emojis.ts` to feel on-brand.

import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { emojis } from '../emojis.js';

export interface WelcomePayloadOptions {
  guildName: string;
  ownerId: string;
  botName: string;
  prefix: string;
}

/** Build the Components V2 welcome payload (no send). */
export function buildWelcomePayload(options: WelcomePayloadOptions): any {
  const { guildName, ownerId, botName, prefix } = options;

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ${emojis.butterflyPink} ${botName} just fluttered into **${guildName}**`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${emojis.blueFlowers} A warm thank you, <@${ownerId}>\n` +
          `${emojis.blueFlowers} I'm all about midnight melodies, anthemic hooks, and the beauty of a fading outro — let's create a soundtrack together.\n` +
          `${emojis.blueFlowers} Type ${prefix}help to see everything I can do.\n` +
          `${emojis.blueFlowers} Or just say ${prefix}play <song name> and I'll take it from there.`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${emojis.blacksparkles} Need an extra hand? Join the support server with \`${prefix}invite\`.`,
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { users: [ownerId] },
  };
}

/**
 * Resolve the guild owner and send the welcome card to the given channel.
 * Silently no-ops on any failure (missing perms, deleted channel, etc.).
 */
export async function sendWelcome({
  channel,
  guild,
  botName,
  prefix,
}: {
  channel: any;
  guild: any;
  botName: string;
  prefix: string;
}): Promise<void> {
  const ownerId: string | null =
    guild.ownerId ?? (await guild.fetchOwner().then((o: any) => o?.id ?? null).catch((): null => null));
  if (!ownerId) return;

  const payload = buildWelcomePayload({
    guildName: guild.name,
    ownerId,
    botName,
    prefix,
  });

  await channel.send(payload).catch((): null => null);
}
