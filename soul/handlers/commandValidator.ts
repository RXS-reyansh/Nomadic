// soul/handlers/commandValidator.ts
import { PermissionsBitField } from 'discord.js';
import { HermacaClient } from '../structures/HermacaClient.js';
import { sendError, reservedForDeveloper, type StatusContext } from '../components/statusMessages.js';

interface ValidationContext {
  userId: string;
  guildId?: string;
  voiceChannelId?: string;
}

interface CommandOptions {
  name: string;
  isDeveloper?: boolean;
  cooldown?: number;
  userPerms?: string[];
  botPerms?: string[];
  inVoiceChannel?: boolean;
  sameVoiceChannel?: boolean;
  player?: boolean;
  [key: string]: any;
}

export async function validate(
  options: CommandOptions,
  context: ValidationContext,
  statusCtx: StatusContext,
  client: HermacaClient,
): Promise<boolean> {
  // Resolve developer list once
  const developers: string[] = client.config.developers.map((dev: any) =>
    typeof dev === 'string' ? dev : dev[1],
  );
  const isDev = developers.includes(context.userId);

  // Developer-only command — block non-devs
  if (options.isDeveloper && !isDev) {
    await reservedForDeveloper(statusCtx);
    return false;
  }

  // Cooldown check
  if (options.cooldown && client.helpers.checkCooldown) {
    const cooldownError = client.helpers.checkCooldown(options.name, context.userId, options.cooldown);
    if (cooldownError) {
      await sendError(statusCtx, cooldownError);
      return false;
    }
  }

  // User permissions — developers bypass this check entirely
  if (!isDev && options.userPerms?.length && client.helpers.checkPermissions) {
    const permError = client.helpers.checkPermissions(context.userId, options.userPerms, context.guildId);
    if (permError) {
      await sendError(statusCtx, permError);
      return false;
    }
  }

  // Bot permissions
  if (options.botPerms && context.guildId) {
    const guild = client.guilds.cache.get(context.guildId);
    const botMember = guild?.members.me;
    if (!botMember) {
      await sendError(statusCtx, 'Unable to verify bot permissions.');
      return false;
    }

    const requiredBits = new PermissionsBitField(options.botPerms as any);
    if (!botMember.permissions.has(requiredBits)) {
      const missing = requiredBits.missing(botMember.permissions).join(', ');
      await sendError(statusCtx, `I need the following permissions: ${missing}`);
      return false;
    }
  }

  // Voice channel requirement
  if (options.inVoiceChannel && !context.voiceChannelId) {
    await sendError(statusCtx, 'You must be in a voice channel to use this command.');
    return false;
  }

  // Same voice channel check
  if (options.sameVoiceChannel && context.guildId) {
    if (!context.voiceChannelId) {
      await sendError(statusCtx, 'You must be in a voice channel to use this command.');
      return false;
    }

    const player = client.kazagumo.players.get(context.guildId) as any;
    if (player && player.voiceId !== context.voiceChannelId) {
      await sendError(statusCtx, 'You must be in the same voice channel as the bot.');
      return false;
    }
  }

  // Active player check — allow paused players (playing=false when paused)
  if (options.player && context.guildId) {
    const player = client.kazagumo.players.get(context.guildId) as any;
    if (!player || !player.queue?.current) {
      await sendError(statusCtx, 'No player is currently active in this server.');
      return false;
    }
  }

  return true;
}
