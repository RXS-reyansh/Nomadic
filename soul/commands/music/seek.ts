// soul/commands/music/seek.ts
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { parseTime, TimeParseError, TIME_FORMAT_HELP } from '../../utils/parseTime.js';
import { formatDuration } from '../../utils/formatting.js';

export const options = {
  name: 'seek',
  aliases: [] as string[],
  description: 'Seek to a specific position in the current track.',
  usage: 'seek <time>',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  cooldown: 2,
};

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean },
  guildId: string,
  rawTime: string,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;

  if (!player || !player.queue?.current) {
    return sendError(ctxObj, 'There is nothing currently playing.');
  }

  const current = player.queue.current;
  if (current.isStream || !current.length) {
    return sendError(ctxObj, "You can't seek inside a livestream.");
  }
  if (current.isSeekable === false) {
    return sendError(ctxObj, 'This track is not seekable.');
  }

  let positionMs: number;
  try {
    positionMs = parseTime(rawTime);
  } catch (err) {
    if (err instanceof TimeParseError) {
      return sendError(ctxObj, `${err.message}\n${TIME_FORMAT_HELP}`);
    }
    throw err;
  }

  if (positionMs > current.length) {
    return sendError(
      ctxObj,
      `Position **${formatDuration(positionMs)}** is beyond track length (**${formatDuration(current.length)}**).`,
    );
  }

  // KazagumoPlayer.seek(position) is async — resolves once Lavalink ACKs.
  try {
    await player.seek(positionMs);
  } catch (err) {
    return sendError(ctxObj, `Failed to seek: ${(err as Error).message}`);
  }

  return sendSuccess(
    ctxObj,
    `Seeked to **${formatDuration(positionMs)}** / **${formatDuration(current.length)}**.`,
  );
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) {
    return sendWrongUsage({ message, client }, options.name, options.usage);
  }
  const raw = args.join(' ');
  await handle({ message, isSlash: false }, message.guild.id, raw, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const raw = interaction.options.getString('time', true);
  await handle({ interaction, isSlash: true }, interaction.guild.id, raw, client);
}
