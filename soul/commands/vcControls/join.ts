import { ChannelType } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess, sendError } from '../../components/statusMessages.js';

export const options = {
  name: 'join',
  aliases: [] as string[],
  description: 'Make the bot join a voice channel.',
  usage: 'join [channel]',
  category: 'vcControls',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: ['Connect', 'Speak'] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 5,
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
      (c: any) => c.type === ChannelType.GuildVoice && c.name.toLowerCase() === lower,
    ) ?? null
  );
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const statusCtx = { message };
  const guild = message.guild;
  const member = message.member;

  let targetChannel: any = null;

  if (args.length > 0) {
    targetChannel = resolveVoiceChannel(guild, args.join(' '));
    if (!targetChannel) return sendError(statusCtx, 'Voice channel not found.');
  } else if (member?.voice?.channel) {
    targetChannel = member.voice.channel;
  } else {
    targetChannel = guild.channels.cache
      .filter((c: any) => c.type === ChannelType.GuildVoice)
      .sort((a: any, b: any) => a.rawPosition - b.rawPosition)
      .first();
  }

  if (!targetChannel) return sendError(statusCtx, 'No voice channel found to join.');

  const botMember = guild.members.me;
  const perms = targetChannel.permissionsFor(botMember);
  if (!perms?.has('Connect') || !perms?.has('Speak')) {
    return sendError(statusCtx, `I don't have permission to join or speak in <#${targetChannel.id}>.`);
  }

  // Kazagumo: kazagumo.players.get() and kazagumo.createPlayer() instead of riffy
  let player: any = client.kazagumo.players.get(guild.id);
  if (player) {
    // Kazagumo: voiceId replaces voiceChannel; textId replaces textChannel
    if (player.voiceId !== targetChannel.id) {
      await player.setVoiceChannel(targetChannel.id).catch((): null => null);
    }
  } else {
    player = await client.kazagumo.createPlayer({
      guildId: guild.id,
      voiceId: targetChannel.id,
      textId: message.channel.id,
      deaf: true,
    }).catch((): null => null);
  }

  return sendSuccess(statusCtx, `Joined <#${targetChannel.id}>.`);
}
