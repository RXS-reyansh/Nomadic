import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError } from '../../components/statusMessages.js';
import { resolveUser } from '../../helpers/userResolver.js';

export const options = {
  name: 'deafen',
  aliases: [] as string[],
  description: 'Server-deafen a user in voice. Defaults to yourself.',
  usage: 'deafen [user]',
  category: 'vcControls',
  isDeveloper: false,
  userPerms: ['DeafenMembers'] as string[],
  botPerms: ['DeafenMembers'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const statusCtx = { message };
  const guild = message.guild;
  const commandUserId: string = message.author.id;

  let targetUser = message.author;
  if (args.length > 0) {
    const resolved = await resolveUser(client, guild, args[0]);
    if (!resolved) return sendError(statusCtx, 'User not found. Try a mention, user ID, or username.');
    targetUser = resolved;
  }

  let targetMember: any;
  try {
    targetMember = await guild.members.fetch(targetUser.id);
  } catch {
    return sendError(statusCtx, 'Could not find that user in this server.');
  }

  if (!targetMember.voice.channel) {
    return sendError(
      statusCtx,
      targetUser.id === commandUserId
        ? 'You are not in any voice channel.'
        : `<@${targetUser.id}> is not in any voice channel.`,
    );
  }

  if (targetMember.voice.serverDeaf) {
    return sendError(
      statusCtx,
      targetUser.id === commandUserId
        ? 'You are already server-deafened.'
        : `<@${targetUser.id}> is already server-deafened.`,
    );
  }

  try {
    await targetMember.voice.setDeaf(true);
    const text =
      targetUser.id === commandUserId
        ? `Deafened you in <#${targetMember.voice.channel.id}>.`
        : `Deafened <@${targetUser.id}> in <#${targetMember.voice.channel.id}>.`;
    return sendSuccess(statusCtx, text);
  } catch (err: any) {
    return sendError(statusCtx, `Failed to deafen: ${err.message}`);
  }
}
