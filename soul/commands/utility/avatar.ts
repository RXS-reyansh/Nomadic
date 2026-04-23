// soul/commands/utility/avatar.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError } from '../../components/statusMessages.js';
import { resolveUser } from '../../helpers/userResolver.js';
import {
  buildChoicePayload,
  buildTimedOutChoicePayload,
  type MediaType,
} from '../../components/avatarBanner.js';
import { sendImagePanel } from '../../helpers/imagePanel.js';

export const options = {
  name: 'avatar',
  aliases: ['av', 'pfp'] as string[],
  description: "View a user's, the bot's, or the server's avatar.",
  usage: `avatar
  avatar @user
  avatar <user ID>
  avatar bot
  avatar server`,
  category: 'utility',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

const TYPE: MediaType = 'avatar';

// ─── Title helpers ────────────────────────────────────────────────────────────

function avatarTitle(displayName: string, variant: 'global' | 'server'): string {
  return `${displayName}'s ${variant === 'server' ? 'Server' : 'Global'} Avatar`;
}

// ─── Choice prompt helper ─────────────────────────────────────────────────────

async function sendWithChoice(
  channel: any,
  sendChoiceMsg: ((payload: any) => Promise<any>) | null,
  displayName: string,
  requesterId: string,
  getUrl: (type: 'server' | 'global') => string | null,
) {
  const choicePayload = buildChoicePayload(displayName, TYPE);

  let promptMsg: any;
  if (sendChoiceMsg) {
    promptMsg = await sendChoiceMsg(choicePayload);
  } else {
    promptMsg = await channel.send(choicePayload);
  }

  if (!promptMsg) return;

  const collector = promptMsg.createMessageComponentCollector({
    filter: (i: any) =>
      (i.customId === `choice:server_${TYPE}` || i.customId === `choice:global_${TYPE}`) &&
      i.user.id === requesterId,
    time: 60_000,
    max: 1,
  });

  collector.on('collect', async (i: any) => {
    await i.deferUpdate();
    const chosen = i.customId === `choice:server_${TYPE}` ? 'server' : 'global';
    const url = getUrl(chosen);
    if (!url) return;
    const title = avatarTitle(displayName, chosen);
    await promptMsg.delete().catch((): null => null);
    await sendImagePanel({ channel, sendAsReply: null, title, imageUrl: url, requesterId, idPrefix: 'av' });
  });

  collector.on('end', async (_: any, reason: string) => {
    if (reason === 'time') {
      await promptMsg.edit(buildTimedOutChoicePayload(displayName, TYPE)).catch((): null => null);
    }
  });
}

// ─── Prefix execute ───────────────────────────────────────────────────────────

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  const guild = message.guild;
  const requesterId = message.author.id;
  const channel = message.channel;

  if (!args.length) {
    const user = await client.users.fetch(message.author.id, { force: true });
    const member = await guild.members.fetch({ user: user.id, force: true }).catch((): null => null);
    const hasServerAvatar = !!(member?.avatar);
    const globalUrl = user.displayAvatarURL({ size: 4096 });
    const serverUrl = member ? member.displayAvatarURL({ size: 4096 }) : null;

    if (hasServerAvatar && serverUrl) {
      return sendWithChoice(channel, null, user.username, requesterId, (t) =>
        t === 'server' ? serverUrl : globalUrl,
      );
    }
    return sendImagePanel({ channel, sendAsReply: null, title: avatarTitle(user.username, 'global'), imageUrl: globalUrl, requesterId, idPrefix: 'av' });
  }

  const firstArg = args[0].toLowerCase();

  if (firstArg === 'server' || firstArg === 'srv') {
    const iconUrl = guild.iconURL({ size: 4096 });
    if (!iconUrl) return sendError({ message }, 'This server does not have an icon.');
    return sendImagePanel({ channel, sendAsReply: null, title: "Server's Icon", imageUrl: iconUrl, requesterId, idPrefix: 'av' });
  }

  if (firstArg === 'bot') {
    const botUser = await client.users.fetch(client.user!.id, { force: true });
    const botMember = await guild.members.fetch({ user: client.user!.id, force: true }).catch((): null => null);
    const hasServerAvatar = !!(botMember?.avatar);
    const globalUrl = botUser.displayAvatarURL({ size: 4096 });
    const serverUrl = botMember ? botMember.displayAvatarURL({ size: 4096 }) : null;

    if (hasServerAvatar && serverUrl) {
      return sendWithChoice(channel, null, 'Bot', requesterId, (t) =>
        t === 'server' ? serverUrl : globalUrl,
      );
    }
    return sendImagePanel({ channel, sendAsReply: null, title: avatarTitle('Bot', 'global'), imageUrl: globalUrl, requesterId, idPrefix: 'av' });
  }

  const targetUser = await resolveUser(client, guild, args[0]);
  if (!targetUser) return sendError({ message }, 'User not found. Try: mention, user ID, or username.');

  const fullUser = await client.users.fetch(targetUser.id, { force: true });
  const member = await guild.members.fetch({ user: fullUser.id, force: true }).catch((): null => null);
  const hasServerAvatar = !!(member?.avatar);
  const globalUrl = fullUser.displayAvatarURL({ size: 4096 });
  const serverUrl = member ? member.displayAvatarURL({ size: 4096 }) : null;

  if (hasServerAvatar && serverUrl) {
    return sendWithChoice(channel, null, fullUser.username, requesterId, (t) =>
      t === 'server' ? serverUrl : globalUrl,
    );
  }
  return sendImagePanel({ channel, sendAsReply: null, title: avatarTitle(fullUser.username, 'global'), imageUrl: globalUrl, requesterId, idPrefix: 'av' });
}

// ─── Slash execute ────────────────────────────────────────────────────────────

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();

  const guild = interaction.guild;
  const requesterId = interaction.user.id;
  const channel = interaction.channel;
  const targetOption: any = interaction.options.getUser('user') ?? null;
  const specialArg: string | null = interaction.options.getString('target') ?? null;

  const sendFirst = (payload: any) => interaction.editReply(payload);

  if (specialArg === 'server') {
    const iconUrl = guild.iconURL({ size: 4096 });
    if (!iconUrl) return sendError({ interaction }, 'This server does not have an icon.');
    return sendImagePanel({ channel, sendAsReply: sendFirst, title: "Server's Icon", imageUrl: iconUrl, requesterId, idPrefix: 'av' });
  }

  if (specialArg === 'bot') {
    const botUser = await client.users.fetch(client.user!.id, { force: true });
    const botMember = await guild.members.fetch({ user: client.user!.id, force: true }).catch((): null => null);
    const hasServerAvatar = !!(botMember?.avatar);
    const globalUrl = botUser.displayAvatarURL({ size: 4096 });
    const serverUrl = botMember ? botMember.displayAvatarURL({ size: 4096 }) : null;

    if (hasServerAvatar && serverUrl) {
      return sendWithChoice(channel, sendFirst, 'Bot', requesterId, (t) =>
        t === 'server' ? serverUrl : globalUrl,
      );
    }
    return sendImagePanel({ channel, sendAsReply: sendFirst, title: avatarTitle('Bot', 'global'), imageUrl: globalUrl, requesterId, idPrefix: 'av' });
  }

  const rawUser = targetOption ?? interaction.user;
  const fullUser = await client.users.fetch(rawUser.id, { force: true });
  const member = await guild.members.fetch({ user: fullUser.id, force: true }).catch((): null => null);
  const hasServerAvatar = !!(member?.avatar);
  const globalUrl = fullUser.displayAvatarURL({ size: 4096 });
  const serverUrl = member ? member.displayAvatarURL({ size: 4096 }) : null;

  if (hasServerAvatar && serverUrl) {
    return sendWithChoice(channel, sendFirst, fullUser.username, requesterId, (t) =>
      t === 'server' ? serverUrl : globalUrl,
    );
  }
  return sendImagePanel({ channel, sendAsReply: sendFirst, title: avatarTitle(fullUser.username, 'global'), imageUrl: globalUrl, requesterId, idPrefix: 'av' });
}
