// soul/slashCommands/music/loop.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Toggle track or queue loop.')
  .addStringOption(o =>
    o.setName('mode')
      .setDescription('Loop mode (default toggles track loop).')
      .addChoices(
        { name: 'track', value: 'track' },
        { name: 'queue', value: 'queue' },
        { name: 'off', value: 'off' },
      ),
  );
