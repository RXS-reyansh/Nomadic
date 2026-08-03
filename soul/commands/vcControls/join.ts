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

async function handle(
  ctx: any,
  client: HermacaClient,
  guild: any,
  textChannelId: string,
  targetChannel: any,
) {
  if (!targetChannel) return sendError(ctx, 'No voice channel found to join.');
  if (!targetChannel.isVoiceBased?.()) {
    return sendError(ctx, 'That channel is not a voice channel.');
  }

  const botMember = guild.members.me;
  const perms = targetChannel.permissionsFor(botMember);
  if (!perms?.has('Connect') || !perms?.has('Speak')) {
    return sendError(ctx, `I don't have permission to join or speak in <#${targetChannel.id}>.`);
  }

  let player: any = client.kazagumo.players.get(guild.id);
  if (player) {
    if (player.voiceId !== targetChannel.id) {
      // setVoiceChannel() is synchronous (returns the player, not a Promise).
      // Wrapping in try/catch to silence any edge-case errors.
      try { player.setVoiceChannel(targetChannel.id); } catch { /* ignore */ }
    }
  } else {
    player = await client.kazagumo.createPlayer({
      guildId: guild.id,
      voiceId: targetChannel.id,
      textId: textChannelId,
      deaf: true,
    }).catch((): null => null);
  }

  return sendSuccess(ctx, `Joined <#${targetChannel.id}>.`);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const ctx = { message };
  const guild = message.guild;
  const member = message.member;

  let targetChannel: any = null;
  if (args.length > 0) {
    targetChannel = resolveVoiceChannel(guild, args.join(' '));
    if (!targetChannel) return sendError(ctx, 'Voice channel not found.');
  } else if (member?.voice?.channel) {
    targetChannel = member.voice.channel;
  } else {
    targetChannel = guild.channels.cache
      .filter((c: any) => c.type === ChannelType.GuildVoice)
      .sort((a: any, b: any) => a.rawPosition - b.rawPosition)
      .first();
  }

  return handle(ctx, client, guild, message.channel.id, targetChannel);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const ctx = { interaction };
  const guild = interaction.guild;
  if (!guild) return sendError(ctx, 'This command can only be used in a server.');

  let targetChannel: any = interaction.options.getChannel('channel');
  if (!targetChannel) {
    const member = await guild.members.fetch(interaction.user.id).catch((): null => null);
    if (member?.voice?.channel) {
      targetChannel = member.voice.channel;
    } else {
      targetChannel = guild.channels.cache
        .filter((c: any) => c.type === ChannelType.GuildVoice)
        .sort((a: any, b: any) => a.rawPosition - b.rawPosition)
        .first();
    }
  }

  return handle(ctx, client, guild, interaction.channelId, targetChannel);
}
