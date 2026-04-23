// soul/slashCommands/music/volume.ts
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set the playback volume (0-200). Resets when the queue ends.')
  .addIntegerOption(o => o.setName('volume').setDescription('0 to 200').setRequired(true).setMinValue(0).setMaxValue(200));
