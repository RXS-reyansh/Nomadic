// soul/components/helpMenu.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import type { HermacaClient } from '../structures/HermacaClient.js';
import { emojis } from '../emojis.js';
import { categories, excludedCategories } from '../config/categories.js';

const INACTIVITY_MS = 3 * 60 * 1000;

// ─────────────────────────── Session tracking ───────────────────────────

export interface HelpSession {
  page: string; // 'home' | 'allcommands' | <categoryName>
  userId: string;
  guildId: string | null;
  channelId: string;
  client: HermacaClient;
}

export const helpSessions = new Map<string, HelpSession>();
const helpTimeouts = new Map<string, NodeJS.Timeout>();

export function registerHelpSession(messageId: string, session: HelpSession): void {
  helpSessions.set(messageId, session);
  resetHelpTimeout(messageId);
}

export function resetHelpTimeout(messageId: string): void {
  const session = helpSessions.get(messageId);
  if (!session) return;

  clearTimeout(helpTimeouts.get(messageId));

  const timeout = setTimeout(async () => {
    try {
      const channel = await session.client.channels.fetch(session.channelId);
      const message = await (channel as any).messages.fetch(messageId);
      let payload: any;
      if (session.page === 'home') {
        payload = await buildHelpMenuPayload(session.client, session.userId, session.guildId, true);
      } else if (session.page === 'allcommands') {
        payload = await buildAllCommandsPayload(session.client, session.userId, session.guildId, true);
      } else {
        payload = await buildCategoryPayload(session.client, session.userId, session.page, session.guildId, true);
      }
      await message.edit(payload);
    } catch (_err) {
      // Message was deleted or inaccessible — silently ignore
    } finally {
      helpSessions.delete(messageId);
      helpTimeouts.delete(messageId);
    }
  }, INACTIVITY_MS);

  helpTimeouts.set(messageId, timeout);
}

// ─────────────────────────── Internal helpers ───────────────────────────

function getCategoryMap(client: HermacaClient): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const cmd of (client.commands?.values() ?? [])) {
    const cat: string = (cmd as any).options?.category as string;
    if (!cat || excludedCategories.includes(cat.toLowerCase())) continue;
    const key = cat.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push((cmd as any).options?.name as string);
  }
  return map;
}

function buildHeaderSection(client: HermacaClient, compact = false): SectionBuilder {
  const avatarUrl = client.user?.displayAvatarURL({ forceStatic: false }) ?? '';
  const descContent = compact
    ? `**A symphony tailored for you.**`
    : `**A symphony tailored for you.**\nPrecision in every rhythm, elegance in every chord—elevating your server's soundscape.`;

  const section = new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# __${client.config.botName} Haven__ ${emojis.musicHeartNote}`),
    new TextDisplayBuilder().setContent(descContent),
  );
  if (avatarUrl) {
    section.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));
  }
  return section;
}

function buildFooterLinks(client: HermacaClient): string | null {
  const clientId = client.config?.clientId ?? '';
  const supportServer: string = (client.config as any).supportServer ?? '';
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&integration_type=0&scope=bot`;
  const parts: string[] = [];
  if (supportServer) parts.push(`[Support Server](${supportServer})`);
  if (clientId) parts.push(`[Invite Me](${inviteUrl})`);
  return parts.length ? parts.join(' • ') : null;
}

function buildNavRow(page: string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Home')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId('help:home')
      .setEmoji({ id: '1494789744717074543', name: 'ChemtrailsGrey_VINYL', animated: true })
      .setDisabled(disabled || page === 'home'),
    new ButtonBuilder()
      .setLabel('All commands')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId('help:allcommands')
      .setEmoji({ id: '1494789896567525416', name: 'LustForLife_VINYL', animated: true })
      .setDisabled(disabled || page === 'allcommands'),
  );
}

function buildNavDropdown(
  client: HermacaClient,
  disabled = false,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const validCategories = getCategoryMap(client);

  const options = categories
    .filter((cat) => validCategories.has(cat.name.toLowerCase()))
    .sort((a, b) => a.index - b.index)
    .map((cat) =>
      new StringSelectMenuOptionBuilder()
        .setValue(cat.name)
        .setLabel(cat.displayName)
        .setDescription(cat.description)
        .setEmoji({ id: '1472173690274971740', name: 'green_sparkles', animated: true }),
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('help:nav')
    .setPlaceholder('Navigate the soundscape.')
    .addOptions(options)
    .setDisabled(disabled);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

async function resolvePrefix(client: HermacaClient, guildId?: string | null): Promise<string> {
  let prefix = client.config?.prefix ?? '$$';
  if (guildId && client.helpers?.getGuildPrefix) {
    const guildPrefix = await client.helpers.getGuildPrefix(guildId);
    if (guildPrefix) prefix = guildPrefix;
  }
  return prefix;
}

// ─────────────────────────── Public payload builders ───────────────────────────

export async function buildHelpMenuPayload(
  client: HermacaClient,
  userId: string,
  guildId?: string | null,
  disabled = false,
) {
  const prefix = await resolvePrefix(client, guildId);
  const categoryMap = getCategoryMap(client);
  const totalCommands = [...categoryMap.values()].reduce((sum, cmds) => sum + cmds.length, 0);

  const categoryLines = [...categoryMap.entries()]
    .sort(([a], [b]) => {
      const ai = categories.find((c) => c.name.toLowerCase() === a)?.index ?? 99;
      const bi = categories.find((c) => c.name.toLowerCase() === b)?.index ?? 99;
      return ai - bi;
    })
    .map(([cat]) => {
      const info = categories.find((c) => c.name.toLowerCase() === cat);
      const display = info?.displayName ?? (cat.charAt(0).toUpperCase() + cat.slice(1));
      return `${emojis.whiteCards} | **${display}**`;
    })
    .join('\n');

  const linksText = buildFooterLinks(client);

  const container = new ContainerBuilder()
    .addSectionComponents(buildHeaderSection(client))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Hey** <@${userId}> ${emojis.gothicHeart}\n` +
          `**Native prefix:** \`${prefix}\`\n` +
          `**Total commands:** ${totalCommands}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (categoryLines) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(categoryLines));
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(buildNavRow('home', disabled))
    .addActionRowComponents(buildNavDropdown(client, disabled) as any)
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (linksText) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${linksText}`));
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
  };
}

export async function buildAllCommandsPayload(
  client: HermacaClient,
  _userId: string,
  _guildId?: string | null,
  disabled = false,
) {
  const categoryMap = getCategoryMap(client);
  const linksText = buildFooterLinks(client);

  const sortedEntries = [...categoryMap.entries()].sort(([a], [b]) => {
    const ai = categories.find((c) => c.name.toLowerCase() === a)?.index ?? 99;
    const bi = categories.find((c) => c.name.toLowerCase() === b)?.index ?? 99;
    return ai - bi;
  });

  const container = new ContainerBuilder()
    .addSectionComponents(buildHeaderSection(client))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  let first = true;
  for (const [cat, cmds] of sortedEntries) {
    if (!first) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    }
    first = false;
    const info = categories.find((c) => c.name.toLowerCase() === cat);
    const displayName = info?.displayName ?? (cat.charAt(0).toUpperCase() + cat.slice(1));
    const cmdList = cmds.map((c) => `\`${c}\``).join(', ');
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${emojis.blackButterfly} **${displayName}**\n- ${cmdList}`),
    );
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(buildNavRow('allcommands', disabled))
    .addActionRowComponents(buildNavDropdown(client, disabled) as any)
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (linksText) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${linksText}`));
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
  };
}

export async function buildCategoryPayload(
  client: HermacaClient,
  _userId: string,
  categoryName: string,
  _guildId?: string | null,
  disabled = false,
) {
  const categoryMap = getCategoryMap(client);
  const cmds = categoryMap.get(categoryName.toLowerCase()) ?? [];
  const catInfo = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  const displayName =
    catInfo?.displayName ?? (categoryName.charAt(0).toUpperCase() + categoryName.slice(1));
  const cmdList = cmds.map((c) => `\`${c}\``).join(', ');
  const linksText = buildFooterLinks(client);

  const container = new ContainerBuilder()
    .addSectionComponents(buildHeaderSection(client, true))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${emojis.blackCross} ${displayName}\n${cmdList || '*No commands available.*'}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(buildNavRow(categoryName.toLowerCase(), disabled))
    .addActionRowComponents(buildNavDropdown(client, disabled) as any)
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (linksText) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${linksText}`));
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
  };
}

export async function buildCommandInfoPayload(
  client: HermacaClient,
  commandName: string,
  guildId?: string | null,
) {
  const cmd = (client.commands as any)?.get(commandName);
  if (!cmd) return null;

  const opts = (cmd as any).options ?? {};
  const name: string = opts.name ?? commandName;
  const description: string = opts.description ?? 'No description provided.';
  const usageRaw: string = opts.usage ?? name;
  const aliases: string[] = Array.isArray(opts.aliases) ? opts.aliases : [];
  const prefix = await resolvePrefix(client, guildId);

  const usageLines = usageRaw
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean);

  let usageBlock: string;
  if (usageLines.length === 1) {
    usageBlock = `${emojis.whiteArrow} **Usage:** \`${usageLines[0]}\``;
  } else {
    usageBlock =
      `${emojis.whiteArrow} **Usage:**\n` +
      usageLines.map((l: string) => `  \`${l}\``).join('\n');
  }

  const aliasText = aliases.length ? aliases.join(', ') : 'No aliases exist.';

  const body =
    `## ${name} command\n` +
    `${emojis.whiteArrow} **Description:** ${description}\n` +
    `${usageBlock}\n` +
    `${emojis.whiteArrow} **Aliases:** ${aliasText}`;

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${emojis.bloodRip} Command Info`),
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Use \`${prefix}help\` to see all commands.`),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications,
  };
}
