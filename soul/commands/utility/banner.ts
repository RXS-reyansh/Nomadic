// soul/commands/utility/banner.ts
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
  name: 'banner',
  aliases: ['bn'] as string[],
  description: "View a user's, the bot's, or the server's banner.",
  usage: `banner
  banner @user
  banner <user ID>
  banner bot
  banner server`,
  category: 'utility',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 3,
};

const TYPE: MediaType = 'banner';

// ─── Title helpers ─────────────────────────────────────────────────────────────

function bannerTitle(displayName: string, variant: 'global' | 'server'): string {
  return `${displayName}'s ${variant === 'server' ? 'Server' : 'Global'} Banner`;
}

// ─── Choice prompt helper ──────────────────────────────────────────────────────

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
    const title = bannerTitle(displayName, chosen);
    await promptMsg.delete().catch((): null => null);
    await sendImagePanel({ channel, sendAsReply: null, title, imageUrl: url, requesterId, idPrefix: 'bn' });
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
    const globalBannerUrl = user.banner ? user.bannerURL({ size: 4096 }) : null;
    const serverBannerUrl = member?.banner ? member.bannerURL({ size: 4096 }) : null;

    if (!globalBannerUrl && !serverBannerUrl) {
      return sendError({ message }, 'You do not have any banner.');
    }
    if (globalBannerUrl && serverBannerUrl) {
      return sendWithChoice(channel, null, user.username, requesterId, (t) =>
        t === 'server' ? serverBannerUrl : globalBannerUrl,
      );
    }
    const url = serverBannerUrl ?? globalBannerUrl!;
    const title = serverBannerUrl ? bannerTitle(user.username, 'server') : bannerTitle(user.username, 'global');
    return sendImagePanel({ channel, sendAsReply: null, title, imageUrl: url, requesterId, idPrefix: 'bn' });
  }

  const firstArg = args[0].toLowerCase();

  if (firstArg === 'server' || firstArg === 'srv') {
    const bannerUrl = guild.bannerURL({ size: 4096 });
    if (!bannerUrl) return sendError({ message }, 'This server does not have a banner.');
    return sendImagePanel({ channel, sendAsReply: null, title: "Server's Banner", imageUrl: bannerUrl, requesterId, idPrefix: 'bn' });
  }

  if (firstArg === 'bot') {
    const botUser = await client.users.fetch(client.user!.id, { force: true });
    const botMember = await guild.members.fetch({ user: client.user!.id, force: true }).catch((): null => null);
    const globalBannerUrl = botUser.banner ? botUser.bannerURL({ size: 4096 }) : null;
    const serverBannerUrl = botMember?.banner ? botMember.bannerURL({ size: 4096 }) : null;

    if (!globalBannerUrl && !serverBannerUrl) {
      return sendError({ message }, 'The bot does not have any banner.');
    }
    if (globalBannerUrl && serverBannerUrl) {
      return sendWithChoice(channel, null, 'Bot', requesterId, (t) =>
        t === 'server' ? serverBannerUrl : globalBannerUrl,
      );
    }
    const url = serverBannerUrl ?? globalBannerUrl!;
    const title = serverBannerUrl ? bannerTitle('Bot', 'server') : bannerTitle('Bot', 'global');
    return sendImagePanel({ channel, sendAsReply: null, title, imageUrl: url, requesterId, idPrefix: 'bn' });
  }

  const targetUser = await resolveUser(client, guild, args[0]);
  if (!targetUser) return sendError({ message }, 'User not found. Try: mention, user ID, or username.');

  const fullUser = await client.users.fetch(targetUser.id, { force: true });
  const member = await guild.members.fetch({ user: fullUser.id, force: true }).catch((): null => null);
  const globalBannerUrl = fullUser.banner ? fullUser.bannerURL({ size: 4096 }) : null;
  const serverBannerUrl = member?.banner ? member.bannerURL({ size: 4096 }) : null;

  if (!globalBannerUrl && !serverBannerUrl) {
    return sendError({ message }, `**${fullUser.username}** does not have any banner.`);
  }
  if (globalBannerUrl && serverBannerUrl) {
    return sendWithChoice(channel, null, fullUser.username, requesterId, (t) =>
      t === 'server' ? serverBannerUrl : globalBannerUrl,
    );
  }
  const url = serverBannerUrl ?? globalBannerUrl!;
  const title = serverBannerUrl
    ? bannerTitle(fullUser.username, 'server')
    : bannerTitle(fullUser.username, 'global');
  return sendImagePanel({ channel, sendAsReply: null, title, imageUrl: url, requesterId, idPrefix: 'bn' });
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
    const bannerUrl = guild.bannerURL({ size: 4096 });
    if (!bannerUrl) return sendError({ interaction }, 'This server does not have a banner.');
    return sendImagePanel({ channel, sendAsReply: sendFirst, title: "Server's Banner", imageUrl: bannerUrl, requesterId, idPrefix: 'bn' });
  }

  if (specialArg === 'bot') {
    const botUser = await client.users.fetch(client.user!.id, { force: true });
    const botMember = await guild.members.fetch({ user: client.user!.id, force: true }).catch((): null => null);
    const globalBannerUrl = botUser.banner ? botUser.bannerURL({ size: 4096 }) : null;
    const serverBannerUrl = botMember?.banner ? botMember.bannerURL({ size: 4096 }) : null;

    if (!globalBannerUrl && !serverBannerUrl) {
      return sendError({ interaction }, 'The bot does not have any banner.');
    }
    if (globalBannerUrl && serverBannerUrl) {
      return sendWithChoice(channel, sendFirst, 'Bot', requesterId, (t) =>
        t === 'server' ? serverBannerUrl : globalBannerUrl,
      );
    }
    const url = serverBannerUrl ?? globalBannerUrl!;
    const title = serverBannerUrl ? bannerTitle('Bot', 'server') : bannerTitle('Bot', 'global');
    return sendImagePanel({ channel, sendAsReply: sendFirst, title, imageUrl: url, requesterId, idPrefix: 'bn' });
  }

  const rawUser = targetOption ?? interaction.user;
  const fullUser = await client.users.fetch(rawUser.id, { force: true });
  const member = await guild.members.fetch({ user: fullUser.id, force: true }).catch((): null => null);
  const globalBannerUrl = fullUser.banner ? fullUser.bannerURL({ size: 4096 }) : null;
  const serverBannerUrl = member?.banner ? member.bannerURL({ size: 4096 }) : null;

  if (!globalBannerUrl && !serverBannerUrl) {
    return sendError({ interaction }, `**${fullUser.username}** does not have any banner.`);
  }
  if (globalBannerUrl && serverBannerUrl) {
    return sendWithChoice(channel, sendFirst, fullUser.username, requesterId, (t) =>
      t === 'server' ? serverBannerUrl : globalBannerUrl,
    );
  }
  const url = serverBannerUrl ?? globalBannerUrl!;
  const title = serverBannerUrl
    ? bannerTitle(fullUser.username, 'server')
    : bannerTitle(fullUser.username, 'global');
  return sendImagePanel({ channel, sendAsReply: sendFirst, title, imageUrl: url, requesterId, idPrefix: 'bn' });
}
