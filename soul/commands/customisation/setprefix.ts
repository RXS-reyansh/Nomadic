// soul/commands/customisation/setprefix.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';

export const options = {
  name: 'setprefix',
  aliases: [] as string[],
  description: "Change the bot's command prefix for this server.",
  usage: `setprefix <new prefix>
  setprefix reset`,
  category: 'customisation',
  isDeveloper: false,
  userPerms: ['Administrator'] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
};

async function handle(
  ctx: { guild: any; user: any; message?: any; interaction?: any; isSlash: boolean },
  newPrefix: string,
  client: HermacaClient,
) {
  const { guild, user, message, interaction, isSlash } = ctx;
  const statusCtx = isSlash ? { interaction } : { message };

  const clean = newPrefix.trim();
  if (!clean) return sendError(statusCtx, 'Prefix cannot be empty.');
  if (clean.length > 10) return sendError(statusCtx, 'Prefix must be **10 characters** or less.');

  const ok = await client.db.setGuildPrefix(guild.id, clean);
  if (!ok) return sendError(statusCtx, 'Failed to save the prefix. Please try again.');

  if (options.cooldown) client.helpers.setCooldown?.(options.name, user.id, options.cooldown);
  return sendSuccess(statusCtx, `Command prefix for this server is now \`${clean}\`.`);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const newPrefix = interaction.options.getString('new_prefix', true);
  await handle(
    { guild: interaction.guild, user: interaction.user, interaction, isSlash: true },
    newPrefix,
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
