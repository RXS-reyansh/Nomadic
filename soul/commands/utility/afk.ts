import {
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError } from '../../components/statusMessages.js';
import { buildAfkConfirmationPayload, type AfkScope } from '../../components/afk.js';
import { emojis } from '../../emojis.js';
import { parseSayText } from '../../helpers/emojiParser.js';
import { resolveEmoji } from '../../helpers/emojiResolver.js';

export const options = {
  name: 'afk',
  aliases: [] as string[],
  description: 'Set your Away from Keyboard status.',
  usage: `afk
  afk <reason>
  afk <reason> <image URL>`,
  category: 'utility',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

interface ParsedAfkInput {
  reason: string;
  imageUrl: string | null;
  sinceAt: Date;
  tillAt: Date | null;
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const rawInput = typeof message.commandRawArgs === 'string' ? message.commandRawArgs : args.join(' ');
  const attachment = message.attachments.first?.() ?? message.attachments.first?.call(message.attachments) ?? null;
  const parsed = await parseAfkInput(rawInput, attachment?.url ?? null, client, message.guild, message.author.id);
  if (!parsed) return sendError({ message }, 'Some emoji identifiers in your AFK reason were invalid.');
  return sendAfkConfirmation({
    client,
    message,
    userId: message.author.id,
    guildId: message.guildId,
    parsed,
  });
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const rawInput: string = interaction.options.getString('text') ?? '';
  const attachment: any = interaction.options.getAttachment('image') ?? null;
  const parsed = await parseAfkInput(rawInput, attachment?.url ?? null, client, interaction.guild, interaction.user.id);
  if (!parsed) return sendError({ interaction }, 'Some emoji identifiers in your AFK reason were invalid.');
  return sendAfkConfirmation({
    client,
    interaction,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    parsed,
  });
}

async function parseAfkInput(
  rawInput: string,
  attachmentUrl: string | null,
  client: HermacaClient,
  guild: any,
  userId: string,
): Promise<ParsedAfkInput | null> {
  let text = rawInput.trim();
  let imageUrl = attachmentUrl;

  let sinceAt = new Date();
  let tillAt: Date | null = null;
  const developerIds = client.config.developers.map((dev: string[]) => dev[1]);

  if (developerIds.includes(userId)) {
    const tsRegex = /<t:(\d{1,13})(?::[tTdDfFR])?>\s*$/;
    const trailingMatch = text.match(tsRegex);
    if (trailingMatch && typeof trailingMatch.index === 'number') {
      text = text.slice(0, trailingMatch.index).replace(/\s+$/, '');
      const date = new Date(Number(trailingMatch[1]) * 1000);
      if (!Number.isNaN(date.getTime())) {
        if (date.getTime() <= Date.now()) sinceAt = date;
        else tillAt = date;
      }
    }
  }

  if (!imageUrl) {
    const parts = text.split(/\s+/);
    const last = parts[parts.length - 1];
    if (/^https?:\/\/\S+$/i.test(last ?? '')) {
      imageUrl = last;
      parts.pop();
      text = parts.join(' ').trim();
    }
  }

  const normalized = text
    .replace(/\\\\n/g, '\u0000')
    .replace(/\\n/g, '\n')
    .replace(/\u0000/g, '\\n');
  const { text: parsedReason, invalid } = await parseSayText(normalized, (id) => resolveEmoji(client, id, guild));
  if (invalid.length) return null;

  return {
    reason: parsedReason.trim() || 'Reason not provided.',
    imageUrl,
    sinceAt,
    tillAt,
  };
}

function buildStatusPayload(icon: string, content: string) {
  const container = new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${icon} ${content}`),
  );
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] as any[] },
  };
}

async function sendAfkConfirmation({
  client,
  message,
  interaction,
  userId,
  guildId,
  parsed,
}: {
  client: HermacaClient;
  message?: any;
  interaction?: any;
  userId: string;
  guildId: string | null;
  parsed: ParsedAfkInput;
}) {
  const sessionId = `${userId}:${Date.now()}`;
  const payload = buildAfkConfirmationPayload({
    reason: parsed.reason,
    imageUrl: parsed.imageUrl,
    sessionId,
  });
  const prompt = interaction
    ? (interaction.deferred
        ? await interaction.editReply(payload)
        : await interaction.reply({ ...payload, fetchReply: true }))
    : await message.reply({ ...payload, allowedMentions: { parse: [], repliedUser: false } });

  const collector = prompt.createMessageComponentCollector({
    filter: (i: any) => i.user.id === userId && i.customId.startsWith(`afk:${sessionId}:`),
    time: 60_000,
    max: 1,
  });

  collector.on('collect', async (i: any) => {
    const action = i.customId.split(':').pop() as AfkScope | 'cancel';

    if (action === 'cancel') {
      await i.update(buildStatusPayload(emojis.redcross, 'AFK confirmation cancelled by the user.'))
        .catch((): null => null);
      return;
    }

    if (action === 'server' && !guildId) {
      await i.update(buildStatusPayload(emojis.redcross, 'Server AFK can only be used inside a server.'))
        .catch((): null => null);
      return;
    }

    await i.deferUpdate().catch((): null => null);

    await client.db.setAFK({
      userId,
      guildId: action === 'server' ? guildId : null,
      scope: action,
      reason: parsed.reason,
      imageUrl: parsed.imageUrl,
      sinceAt: parsed.sinceAt,
      tillAt: parsed.tillAt,
    });

    await i.editReply(
      buildStatusPayload(
        emojis.blacktick,
        action === 'server'
          ? 'Your AFK has been set for this server.'
          : 'Your AFK has been set for all mutual servers.',
      ),
    ).catch((): null => null);
  });

  collector.on('end', async (_: any, reason: string) => {
    if (reason !== 'time') return;
    await prompt.edit(buildAfkConfirmationPayload({
      reason: parsed.reason,
      imageUrl: parsed.imageUrl,
      sessionId,
      disabled: true,
      footer: '-# Confirmation timed out',
    })).catch((): null => null);
  });
}
