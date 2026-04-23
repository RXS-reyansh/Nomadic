import { ChannelType } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError } from '../../components/statusMessages.js';
import { resolveUser } from '../../helpers/userResolver.js';

export const options = {
  name: 'shift',
  aliases: [] as string[],
  description: 'Move a user to another voice channel. Defaults to yourself → bot\'s channel.',
  usage: 'shift [user] [channel]',
  category: 'vcControls',
  isDeveloper: false,
  userPerms: ['MoveMembers'] as string[],
  botPerms: ['MoveMembers'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

function resolveVoiceChannel(guild: any, arg: string): any | null {
  const idMatch = arg.match(/^<#(\d+)>$/) ?? arg.match(/^(\d{17,20})$/);
  if (idMatch) {
    const ch = guild.channels.cache.get(idMatch[1]);
    return ch?.isVoiceBased?.() ? ch : null;
  }
  const lower = arg.toLowerCase();
  return (
    guild.channels.cache.find(
      (c: any) => c.isVoiceBased?.() && c.name.toLowerCase() === lower,
    ) ?? null
  );
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const statusCtx = { message };
  const guild = message.guild;
  const commandUserId: string = message.author.id;

  let targetUser = message.author;
  let destChannel: any = null;
  const remaining = [...args];

  if (remaining.length > 0) {
    const resolved = await resolveUser(client, guild, remaining[0]);
    if (resolved) {
      targetUser = resolved;
      remaining.shift();
    }
  }

  if (remaining.length > 0) {
    destChannel = resolveVoiceChannel(guild, remaining[0]);
    if (destChannel) remaining.shift();
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

  const sourceChannel = targetMember.voice.channel;

  if (!destChannel) {
    const botMember = guild.members.me;
    if (botMember?.voice?.channel) {
      destChannel = botMember.voice.channel;
    } else {
      destChannel = guild.channels.cache
        .filter((c: any) => c.type === ChannelType.GuildVoice)
        .sort((a: any, b: any) => a.rawPosition - b.rawPosition)
        .first();
    }
  }

  if (!destChannel) return sendError(statusCtx, 'No voice channel found to move to.');

  if (destChannel.id === sourceChannel.id) {
    return sendError(
      statusCtx,
      targetUser.id === commandUserId
        ? 'You are already in that voice channel.'
        : `<@${targetUser.id}> is already in that voice channel.`,
    );
  }

  try {
    await targetMember.voice.setChannel(destChannel);
    const text =
      targetUser.id === commandUserId
        ? `Moved you from <#${sourceChannel.id}> to <#${destChannel.id}>.`
        : `Moved <@${targetUser.id}> from <#${sourceChannel.id}> to <#${destChannel.id}>.`;
    return sendSuccess(statusCtx, text);
  } catch (err: any) {
    return sendError(statusCtx, `Failed to shift: ${err.message}`);
  }
}
