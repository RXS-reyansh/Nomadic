// soul/commands/music/add.ts
//
// Add a song or playlist to a specific position in the queue.
// Usage: add <position> <song name or URL>
//
// Position 1 = top of queue (next to play). The lookup logic mirrors play.ts
// (uses unifiedSearch). After insertion, refreshes the now-playing panel.

import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError, sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';
import { unifiedSearch } from '../../helpers/sourceSearch.js';
import { updateNowPlayingMessage } from '../../helpers/nowPlayingManager.js';

export const options = {
  name: 'add',
  aliases: [] as string[],
  description: 'Add a song or playlist to a specific position in the queue.',
  usage: 'add <position> <song name or URL>',
  category: 'music',
  isDeveloper: false,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: true,
  inVoiceChannel: true,
  sameVoiceChannel: true,
  cooldown: 3,
};

async function handle(
  ctx: { message?: any; interaction?: any; isSlash: boolean; user: any },
  guildId: string,
  position: number,
  query: string,
  client: HermacaClient,
) {
  const ctxObj = ctx.isSlash ? { interaction: ctx.interaction } : { message: ctx.message };
  const player = client.kazagumo.players.get(guildId) as any;
  if (!player) return sendError(ctxObj, 'There is no active player in this server.');

  // Position 1 = first in queue (next to play). Cap at queue.length + 1.
  const max = player.queue.length + 1;
  if (position < 1 || position > max) {
    return sendError(ctxObj, `Position must be between 1 and ${max}.`);
  }

  let result: any;
  try {
    result = await unifiedSearch(client, query, ctx.user);
  } catch {
    return sendError(ctxObj, 'Failed to search for that song. Please try again.');
  }
  if (!result?.tracks?.length) return sendError(ctxObj, 'No results found for your query.');

  // KazagumoQueue extends Array → splice() inserts in place.
  const idx = position - 1;
  if (result.type === 'PLAYLIST') {
    player.queue.splice(idx, 0, ...result.tracks);
    await updateNowPlayingMessage(client, player).catch((): null => null);
    return sendSuccess(
      ctxObj,
      `Added **${result.tracks.length} tracks** from **${result.playlistName ?? 'playlist'}** at position **#${position}**.`,
    );
  } else {
    const track = result.tracks[0];
    player.queue.splice(idx, 0, track);
    await updateNowPlayingMessage(client, player).catch((): null => null);
    return sendSuccess(ctxObj, `Added **${track.title}** at position **#${position}**.`);
  }
}

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (args.length < 2) return sendWrongUsage({ message, client }, options.name, options.usage);
  const pos = parseInt(args[0], 10);
  if (isNaN(pos) || pos < 1) return sendError({ message }, 'Please provide a valid position number.');
  const query = args.slice(1).join(' ');
  await handle({ message, isSlash: false, user: message.author }, message.guild.id, pos, query, client);
}

export async function slashExecute(interaction: any, client: HermacaClient) {
  await interaction.deferReply();
  const pos = interaction.options.getInteger('position', true);
  const query = interaction.options.getString('song', true);
  await handle({ interaction, isSlash: true, user: interaction.user }, interaction.guild.id, pos, query, client);
}
