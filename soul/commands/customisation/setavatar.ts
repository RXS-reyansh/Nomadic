// soul/commands/customisation/setavatar.ts
import { REST, Routes } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError, sendLoading } from '../../components/statusMessages.js';
import { imageUrlToBase64, isValidImageUrl } from '../../utils/imageUtils.js';

export const options = {
  name: 'setavatar',
  aliases: ['setav', 'setpfp'] as string[],
  description: "Change the bot's server avatar.",
  usage: `setavatar <image attachment OR image URL> 
    setavatar reset`,
  category: 'customisation',
  isDeveloper: false,
  userPerms: ['Administrator'] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 10,
};

async function patchAvatar(guildId: string, avatar: string | null, token: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.patch(Routes.guildMember(guildId, '@me'), { body: { avatar } });
}

async function handle(
  ctx: { guild: any; user: any; message?: any; interaction?: any; isSlash: boolean },
  imageUrl: string | null,
  isReset: boolean,
  client: HermacaClient,
) {
  const { guild, user, message, interaction, isSlash } = ctx;
  const statusCtx = isSlash ? { interaction } : { message };
  const successCtx = { channel: isSlash ? interaction.channel : message.channel };

  if (!isReset && !imageUrl) {
    return sendError(statusCtx, 'Please attach an image, provide a direct image URL, or use `reset`.');
  }

  const loadingMsg = await sendLoading(statusCtx, isReset ? 'Resetting server avatar...' : 'Setting server avatar...');

  try {
    if (isReset) {
      await patchAvatar(guild.id, null, client.config.botToken as string);
      if (options.cooldown) client.helpers.setCooldown?.(options.name, user.id, options.cooldown);
      await sendSuccess(successCtx, 'Server avatar reset to global avatar.');
      setTimeout(() => (loadingMsg as any)?.delete().catch((): null => null), 2000);
      return;
    }

    const base64 = await imageUrlToBase64(imageUrl!);
    await patchAvatar(guild.id, base64, client.config.botToken as string);
    if (options.cooldown) client.helpers.setCooldown?.(options.name, user.id, options.cooldown);
    await sendSuccess(successCtx, 'Server avatar updated successfully.');
    setTimeout(() => (loadingMsg as any)?.delete().catch((): null => null), 2000);
  } catch (err: any) {
    client.logger.error('SETAVATAR', err.message);
    return sendError(successCtx, `Failed to update avatar: ${err.message}`);
  }
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const image = interaction.options.getAttachment('image');
  const reset = interaction.options.getBoolean('reset') ?? false;
  await handle(
    { guild: interaction.guild, user: interaction.user, interaction, isSlash: true },
    image?.url ?? null,
    reset,
    client,
  );
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { guild: message.guild, user: message.author, message, isSlash: false };

  if (args[0]?.toLowerCase() === 'reset') {
    return handle(ctx, null, true, client);
  }

  let imageUrl: string | null = null;
  if (message.attachments.size) {
    imageUrl = message.attachments.first().url;
  } else if (args[0] && isValidImageUrl(args[0])) {
    imageUrl = args[0];
  }

  return handle(ctx, imageUrl, false, client);
}
