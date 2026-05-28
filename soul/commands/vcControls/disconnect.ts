import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError } from '../../components/statusMessages.js';
import { resolveUser } from '../../helpers/userResolver.js';

export const options = {
  name: 'disconnect',
  aliases: ['dsc', 'devoice'] as string[],
  description: 'Disconnect a user from their voice channel. Defaults to yourself.',
  usage: 'disconnect [user]',
  category: 'vcControls',
  isDeveloper: false,
  userPerms: ['MoveMembers'] as string[],
  botPerms: ['MoveMembers'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

async function handle(
  ctx: any,
  guild: any,
  targetUser: any,
  commandUserId: string,
) {
  let targetMember: any;
  try {
    targetMember = await guild.members.fetch(targetUser.id);
  } catch {
    return sendError(ctx, 'Could not find that user in this server.');
  }

  if (!targetMember.voice.channel) {
    return sendError(
      ctx,
      targetUser.id === commandUserId
        ? 'You are not in any voice channel.'
        : `<@${targetUser.id}> is not in any voice channel.`,
    );
  }

  const sourceChannel = targetMember.voice.channel;

  try {
    await targetMember.voice.disconnect();
    const text =
      targetUser.id === commandUserId
        ? `Disconnected you from <#${sourceChannel.id}>.`
        : `Disconnected <@${targetUser.id}> from <#${sourceChannel.id}>.`;
    return sendSuccess(ctx, text);
  } catch (err: any) {
    return sendError(ctx, `Failed to disconnect: ${err.message}`);
  }
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  const guild = message.guild;
  const commandUserId: string = message.author.id;

  let targetUser = message.author;
  if (args.length > 0) {
    const resolved = await resolveUser(client, guild, args[0]);
    if (!resolved) return sendError(ctx, 'User not found. Try a mention, user ID, or username.');
    targetUser = resolved;
  }

  return handle(ctx, guild, targetUser, commandUserId);
}

export async function slashExecute(interaction: any, _client: HermacaClient) {
  await interaction.deferReply();
  const ctx = { interaction };
  const guild = interaction.guild;
  if (!guild) return sendError(ctx, 'This command can only be used in a server.');

  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  return handle(ctx, guild, targetUser, interaction.user.id);
}
