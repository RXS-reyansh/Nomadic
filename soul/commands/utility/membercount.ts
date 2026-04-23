import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError } from '../../components/statusMessages.js';
import { emojis } from '../../emojis.js';
import { escapeMarkdown } from '../../utils/formatting.js';

export const options = {
  name: 'membercount',
  aliases: ['memcount', 'mc'] as string[],
  description: "Show the server's member count breakdown.",
  usage: 'membercount',
  category: 'utility',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

function isDeveloper(userId: string, client: HermacaClient): boolean {
  return client.config.developers.some((dev: any) =>
    typeof dev === 'string' ? dev === userId : dev[1] === userId,
  );
}

async function buildMembercountPayload(
  guild: any,
  requestedBy: string,
): Promise<object> {
  const members = await guild.members.fetch();

  let users = 0;
  let bots = 0;
  for (const [, member] of members) {
    if (member.user.bot) bots++;
    else users++;
  }
  const total = users + bots;

  const time = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const safeName = escapeMarkdown(guild.name);

  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${safeName} Member count`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `${emojis.whiteArrow} Total Members: ${total}`,
          `${emojis.whiteArrow} Users: ${users}`,
          `${emojis.whiteArrow} Bots: ${bots}`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Requested by ${requestedBy} at ${time}`),
    );
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const statusCtx = { message };

  let guild = message.guild;

  if (args.length > 0 && isDeveloper(message.author.id, client)) {
    const guildId = args[0].trim();
    const found = client.guilds.cache.get(guildId);
    if (!found) return sendError(statusCtx, `No server found with ID \`${guildId}\`.`);
    guild = found;
  }

  const container = await buildMembercountPayload(guild, message.author.username);

  await message.channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
}
