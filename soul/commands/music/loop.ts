// soul/commands/music/loop.ts
//
// Toggle loop modes:
//   loop          → toggles track loop (none ↔ track)
//   loop queue    → toggles queue loop (none ↔ queue)
//   loop off      → disables looping

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'loop',
  aliases: ['repeat'] as string[],
  description: 'Toggle track or queue loop.',
  usage: `loop          (toggles track loop)
  loop queue    (toggles queue loop)
  loop off      (disables looping)`,
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  cooldown: 2,
};

type LoopMode = 'none' | 'track' | 'queue';

function describe(mode: LoopMode): string {
  if (mode === 'track') return 'Track loop **enabled**.';
  if (mode === 'queue') return 'Queue loop **enabled**.';
  return 'Looping **disabled**.';
}

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guildId: string,
  arg: string | null,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;
  if (!player) return sendError(ctxObj, 'There is no active player in this server.');

  const current: LoopMode = (player.loop ?? 'none') as LoopMode;
  let next: LoopMode;
  const a = (arg ?? '').toLowerCase();

  if (a === 'queue' || a === 'q') {
    next = current === 'queue' ? 'none' : 'queue';
  } else if (a === 'off' || a === 'none' || a === 'disable') {
    next = 'none';
  } else if (a === 'track' || a === 'song' || a === 't') {
    next = current === 'track' ? 'none' : 'track';
  } else if (a === '') {
    next = current === 'track' ? 'none' : 'track';
  } else {
    return sendError(ctxObj, `Unknown argument \`${arg}\`. Try: \`loop\`, \`loop queue\`, or \`loop off\`.`);
  }

  player.setLoop(next);
  await updateNowPlayingMessage(client, player).catch((): null => null);
  return sendSuccess(ctxObj, describe(next));
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  await handle({ message, isSlash: false }, message.guild.id, args[0] ?? null, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const mode = interaction.options.getString('mode') ?? null;
  await handle({ interaction, isSlash: true }, interaction.guild.id, mode, client);
}
