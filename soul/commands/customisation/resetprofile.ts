// soul/commands/customisation/resetprofile.ts
import { REST, Routes } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError, sendLoading } from '../../components/statusMessages.js';

export const options = {
  name: 'resetprofile',
  aliases: [] as string[],
  description: "Reset the bot's server profile (nickname, avatar, banner, bio) to global defaults.",
  usage: 'resetprofile',
  category: 'customisation',
  isDeveloper: false,
  userPerms: ['Administrator'] as string[],
  botPerms: ['ChangeNickname'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 10,
};

async function handle(
  ctx: { guild: any; user: any; message?: any; interaction?: any; isSlash: boolean },
  client: HermacaClient,
) {
  const { guild, user, message, interaction, isSlash } = ctx;
  const statusCtx = isSlash ? { interaction } : { message };
  const successCtx = { channel: isSlash ? interaction.channel : message.channel };

  const loadingMsg = await sendLoading(statusCtx, 'Resetting server profile to global defaults...');

  try {
    const rest = new REST({ version: '10' }).setToken(client.config.botToken as string);
    await rest.patch(Routes.guildMember(guild.id, '@me'), {
      body: { nick: null, avatar: null, banner: null, bio: null },
    });
    if (options.cooldown) client.helpers.setCooldown?.(options.name, user.id, options.cooldown);
    await sendSuccess(successCtx, 'Server profile reset to global defaults.');
    setTimeout(() => (loadingMsg as any)?.delete().catch((): null => null), 2000);
  } catch (err: any) {
    client.logger.error('RESETPROFILE', err.message);
    return sendError(successCtx, `Failed to reset profile: ${err.message}`);
  }
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  await handle(
    { guild: interaction.guild, user: interaction.user, interaction, isSlash: true },
    client,
  );
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  await handle(
    { guild: message.guild, user: message.author, message, isSlash: false },
    client,
  );
}
