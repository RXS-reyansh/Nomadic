// soul/handlers/helperLoader.ts
import { HermacaClient } from '../structures/HermacaClient.js';
import logger from '../console/logger.js';
import { updateNowPlayingMessage, disableNowPlayingButtons, clearPlayerState } from '../helpers/nowPlayingManager.js';

export async function loadHelpers(client: HermacaClient): Promise<Record<string, any>> {
  logger.info('HELPERS', 'Loading helper functions...');

  const helpers = {
    checkCooldown: (commandName: string, userId: string, _cooldownSeconds: number): string | null => {
      const cooldownKey = `${commandName}_${userId}`;
      const now = Date.now();
      const expirationTime = client.cooldowns.get(cooldownKey) || 0;
      if (expirationTime > now) {
        const remainingSeconds = Math.ceil((expirationTime - now) / 1000);
        return `You're on cooldown for this command. Wait ${remainingSeconds}s.`;
      }
      return null;
    },

    setCooldown: (commandName: string, userId: string, cooldownSeconds: number): void => {
      const cooldownKey = `${commandName}_${userId}`;
      client.cooldowns.set(cooldownKey, Date.now() + cooldownSeconds * 1000);
    },

    checkPermissions: (userId: string, requiredPerms: string[], guildId?: string): string | null => {
      if (!guildId) return 'Guild context required for permission check.';
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return 'Guild not found.';
      const member = guild.members.cache.get(userId);
      if (!member) return 'Member not found.';
      const missing = requiredPerms.filter(perm => !member.permissions.has(perm as any));
      if (missing.length > 0) return `You need the following permissions: ${missing.join(', ')}`;
      return null;
    },

    getGuildPrefix: async (guildId: string): Promise<string | null> => {
      if (!client.db) return null;
      return client.db.getGuildPrefix(guildId);
    },

    validateCommand: async (_command: any, _context: any): Promise<boolean> => true,

    handleMusicButton: async (interaction: any): Promise<void> => {
      const { customId } = interaction;

      // Only handle player:* buttons — all other buttons (choice prompts, DM panels, etc.)
      // are handled by their own message component collectors.
      if (!customId.startsWith('player:')) return;

      await interaction.deferUpdate().catch(() => {});

      const player = client.kazagumo.players.get(interaction.guildId) as any;
      if (!player) return;

      switch (customId) {
        case 'player:previous': {
          // Kazagumo: getPrevious(remove) returns and optionally removes from history
          const prevTrack = player.getPrevious(true);
          if (!prevTrack) return;
          // Re-queue: [prevTrack, current, ...rest] so skip() lands on prevTrack
          const current = player.queue.current;
          if (current) player.queue.unshift(current);
          player.queue.unshift(prevTrack);
          player.skip();
          return;
        }

        case 'player:pause': {
          // Kazagumo: pause(boolean) — true = pause, false = resume; no resume() method
          if (player.paused) player.pause(false);
          else player.pause(true);
          break;
        }

        case 'player:stop': {
          await disableNowPlayingButtons(client, player);
          clearPlayerState(player.guildId);
          await player.destroy().catch((): null => null);
          return;
        }

        case 'player:skip': {
          if (!player.queue.length) return;
          player.skip();
          return;
        }

        case 'player:volDown': {
          const newVol = Math.max(0, (player.volume ?? 100) - 10);
          await player.setVolume(newVol).catch((): null => null);
          break;
        }

        case 'player:volUp': {
          const newVol = Math.min(100, (player.volume ?? 100) + 10);
          await player.setVolume(newVol).catch((): null => null);
          break;
        }

        case 'player:loop': {
          const modes = ['none', 'track', 'queue'] as const;
          const current = player.loop ?? 'none';
          const next = modes[(modes.indexOf(current as any) + 1) % modes.length];
          player.setLoop(next);
          break;
        }

        case 'player:autoplay': {
          const current = player.data.get('isAutoplay') ?? false;
          player.data.set('isAutoplay', !current);
          break;
        }

        default:
          return;
      }

      await updateNowPlayingMessage(client, player).catch((err: Error) => {
        logger.error('BUTTON', `Failed to update now playing message: ${err.message}`);
      });
    },
  };

  logger.success('HELPERS', 'Helpers loaded');
  return helpers;
}
