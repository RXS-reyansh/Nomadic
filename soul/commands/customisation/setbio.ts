// soul/commands/customisation/setbio.ts
import { REST, Routes } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError, sendLoading } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';

export const options = {
  name: 'setbio',
  aliases: [] as string[],
  description: "Set the bot's server profile bio.",
  usage: `setbio <text>
  setbio reset
  (use \\n for new lines)`,
  category: 'customisation',
  isDeveloper: false,
  userPerms: ['Administrator'] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

const BIO_LIMIT = 190;

async function patchBio(guildId: string, bio: string | null, token: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.patch(Routes.guildMember(guildId, '@me'), { body: { bio } });
}

async function handle(
  ctx: { guild: any; user: any; message?: any; interaction?: any; isSlash: boolean },
  rawText: string,
  client: HermacaClient,
) {
  const { guild, user, message, interaction, isSlash } = ctx;
  const statusCtx = isSlash ? { interaction } : { message };
  const successCtx = { channel: isSlash ? interaction.channel : message.channel };

  const isReset = rawText.toLowerCase() === 'reset';

  if (isReset) {
    const loadingMsg = await sendLoading(statusCtx, 'Resetting server bio...');
    try {
      await patchBio(guild.id, null, client.config.botToken as string);
      if (options.cooldown) client.helpers.setCooldown?.(options.name, user.id, options.cooldown);
      await sendSuccess(successCtx, 'Server bio reset to global default.');
      setTimeout(() => (loadingMsg as any)?.delete().catch((): null => null), 2000);
      return;
    } catch (err: any) {
      client.logger.error('SETBIO', err.message);
      return sendError(successCtx, `Failed to reset bio: ${err.message}`);
    }
  }

  const finalBio = rawText.replace(/\\n/g, '\n');

  if (finalBio.length > BIO_LIMIT) {
    return sendError(
      statusCtx,
      `Bio exceeds the **${BIO_LIMIT} character limit** (current: **${finalBio.length}**). Please shorten by **${finalBio.length - BIO_LIMIT}** characters.`,
    );
  }

  const loadingMsg = await sendLoading(statusCtx, 'Setting server bio...');

  try {
    await patchBio(guild.id, finalBio, client.config.botToken as string);
    const quoted = finalBio.split('\n').map((l: string) => `> ${l}`).join('\n');
    if (options.cooldown) client.helpers.setCooldown?.(options.name, user.id, options.cooldown);
    await sendSuccess(successCtx, `Server bio set to:\n${quoted}`);
    setTimeout(() => (loadingMsg as any)?.delete().catch((): null => null), 2000);
  } catch (err: any) {
    client.logger.error('SETBIO', err.message);
    if (err.message?.includes('50035')) {
      return sendError(successCtx, 'Invalid bio format. Please check for unsupported characters.');
    }
    return sendError(successCtx, `Failed to set bio: ${err.message}`);
  }
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const text = interaction.options.getString('text', true);
  await handle(
    { guild: interaction.guild, user: interaction.user, interaction, isSlash: true },
    text,
    client,
  );
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);
  await handle(
    { guild: message.guild, user: message.author, message, isSlash: false },
    args.join(' '),
    client,
  );
}
