// soul/commands/customisation/setname.ts
import { REST, Routes } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError, sendLoading } from '../../components/statusMessages.js';

export const options = {
  name: 'setname',
  aliases: [] as string[],
  description: "Change the bot's nickname in this server.",
  usage: `setname <nickname>
  setname reset`,
  category: 'customisation',
  isDeveloper: false,
  userPerms: ['Administrator'] as string[],
  botPerms: ['ChangeNickname'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

async function setNickname(
  guildId: string,
  nick: string | null,
  token: string,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.patch(Routes.guildMember(guildId, '@me'), { body: { nick } });
}

async function handle(
  ctx: { guild: any; user: any; message?: any; interaction?: any; isSlash: boolean },
  nick: string | null,
  client: HermacaClient,
) {
  const { guild, user, message, interaction, isSlash } = ctx;
  const statusCtx = isSlash ? { interaction } : { message };
  const successCtx = { channel: isSlash ? interaction.channel : message.channel };

  if (nick !== null && nick.length > 32) {
    return sendError(statusCtx, 'Nickname must be **32 characters** or less.');
  }

  const loadingMsg = await sendLoading(statusCtx, nick ? 'Changing nickname...' : 'Resetting nickname...');

  try {
    await setNickname(guild.id, nick, client.config.botToken as string);
    if (options.cooldown) client.helpers.setCooldown?.(options.name, user.id, options.cooldown);
    await sendSuccess(
      successCtx,
      nick ? `Nickname changed to **${nick}**.` : 'Nickname reset to global username.',
    );
    setTimeout(() => (loadingMsg as any)?.delete().catch((): null => null), 2000);
  } catch (err: any) {
    client.logger.error('SETNAME', err.message);
    if (err.status === 403) return sendError(successCtx, 'Missing permissions to change the nickname.');
    return sendError(successCtx, `Failed to change nickname: ${err.message}`);
  }
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const nick = interaction.options.getString('nickname') ?? null;
  await handle(
    { guild: interaction.guild, user: interaction.user, interaction, isSlash: true },
    nick,
    client,
  );
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { guild: message.guild, user: message.author, message, isSlash: false };
  const input = args.join(' ').trim();
  const nick = input.toLowerCase() === 'reset' ? null : input || null;
  await handle(ctx, nick, client);
}
