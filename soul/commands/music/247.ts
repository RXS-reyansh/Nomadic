// soul/commands/music/247.ts
import { ChannelType } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess, sendInfo } from '../../components/statusMessages.js';
import { scheduleRejoin } from '../../helpers/twentyFourSeven.js';

export const options = {
  name: '24/7',
  slashName: '24-7',
  aliases: ['247', '24-7', 'twentyfourseven', 'twenty-four-seven', '24*7'] as string[],
  description: 'Manage 24/7 mode — keep the bot permanently connected to a voice channel.',
  usage: '247 <enable [channel] | disable | view>',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

async function resolveVoiceChannel(guild: any, raw: string | null): Promise<any | null> {
  if (!raw) return null;
  const mentionMatch = raw.match(/^<#(\d+)>$/);
  const channelId = mentionMatch ? mentionMatch[1] : raw.trim();
  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) return null;
  return channel;
}

async function handleEnable(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guild: any,
  rawArg: string | null,
  client: HermacaClient,
): Promise<any> {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };

  let targetChannel: any = null;

  if (rawArg) {
    targetChannel = await resolveVoiceChannel(guild, rawArg);
    if (!targetChannel) {
      return sendError(ctxObj, 'Could not find that voice channel. Please mention a valid voice channel or provide its ID.');
    }
  } else {
    const botMember = guild.members.me;
    const botVoice = botMember?.voice?.channel;
    if (!botVoice) {
      return sendError(ctxObj, 'I am not in any voice channel. Either join a voice channel first, or provide a channel ID/mention.');
    }
    targetChannel = botVoice;
  }

  const current = await client.db?.get24Seven(guild.id).catch((): null => null);
  if (current?.enabled && current.channelId === targetChannel.id) {
    return sendInfo(ctxObj, `24/7 is already enabled in <#${targetChannel.id}>. No changes made.`);
  }

  await client.db?.set24Seven(guild.id, targetChannel.id);

  const player = client.kazagumo.players.get(guild.id) as any;
  if (!player) {
    try {
      await client.kazagumo.createPlayer({
        guildId: guild.id,
        voiceId: targetChannel.id,
        textId: ctx.message?.channel?.id ?? ctx.interaction?.channel?.id ?? guild.systemChannelId ?? targetChannel.id,
        deaf: true,
      });
    } catch {
      // Non-fatal — bot will auto-join next restart anyway
    }
  } else if (player.voiceId !== targetChannel.id) {
    scheduleRejoin(client, guild.id, targetChannel.id, 0);
  }

  return sendSuccess(ctxObj, `24/7 mode enabled! I will stay in <#${targetChannel.id}> permanently.`);
}

async function handleDisable(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guild: any,
  client: HermacaClient,
): Promise<any> {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const current = await client.db?.get24Seven(guild.id).catch((): null => null);

  if (!current?.enabled) {
    return sendInfo(ctxObj, '24/7 mode is not currently enabled in this server.');
  }

  await client.db?.clear24Seven(guild.id);
  return sendSuccess(ctxObj, '24/7 mode has been disabled. The bot will leave normally when the queue ends.');
}

async function handleView(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guild: any,
  client: HermacaClient,
): Promise<any> {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const current = await client.db?.get24Seven(guild.id).catch((): null => null);

  if (!current?.enabled) {
    return sendInfo(ctxObj, '24/7 mode is not currently enabled in this server.');
  }

  return sendInfo(ctxObj, `24/7 channel is: <#${current.channelId}>`);
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const subcommand = args[0]?.toLowerCase();
  const ctx = { message, isSlash: false };

  if (subcommand === 'enable') {
    await handleEnable(ctx, message.guild, args[1] ?? null, client);
  } else if (subcommand === 'disable') {
    await handleDisable(ctx, message.guild, client);
  } else if (subcommand === 'view') {
    await handleView(ctx, message.guild, client);
  } else {
    await sendError({ message }, `Invalid subcommand. Usage: \`${options.usage}\``);
  }
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const ctx = { interaction, isSlash: true };

  if (sub === 'enable') {
    const channel = interaction.options.getChannel('channel', false);
    await handleEnable(ctx, interaction.guild, channel?.id ?? null, client);
  } else if (sub === 'disable') {
    await handleDisable(ctx, interaction.guild, client);
  } else if (sub === 'view') {
    await handleView(ctx, interaction.guild, client);
  }
}
