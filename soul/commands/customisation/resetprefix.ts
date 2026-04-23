// soul/commands/customisation/resetprefix.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendInfo, sendError } from '../../components/statusMessages.js';

export const options = {
  name: 'resetprefix',
  aliases: [] as string[],
  description: "Remove this server's custom prefix and use the global prefix again.",
  usage: 'resetprefix',
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
  client: HermacaClient,
) {
  const { guild, user, message, interaction, isSlash } = ctx;
  const statusCtx = isSlash ? { interaction } : { message };

  const globalPrefix = client.config?.prefix ?? '$$';

  const existing = await client.db.getGuildPrefix(guild.id);
  if (!existing) {
    return sendInfo(statusCtx, `The bot already uses the global prefix (\`${globalPrefix}\`).`);
  }

  const ok = await client.db.removeGuildPrefix(guild.id);
  if (!ok) return sendError(statusCtx, 'Failed to remove the server prefix. Please try again.');

  if (options.cooldown) client.helpers.setCooldown?.(options.name, user.id, options.cooldown);
  return sendSuccess(
    statusCtx,
    `Server prefix has been removed. Bot uses the global prefix (\`${globalPrefix}\`) now.`,
  );
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  await handle({ guild: interaction.guild, user: interaction.user, interaction, isSlash: true }, client);
}

export async function prefixExecute(message: any, _args: string[], client: HermacaClient) {
  await handle({ guild: message.guild, user: message.author, message, isSlash: false }, client);
}
