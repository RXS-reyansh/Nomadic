// soul/config/categories.ts
import { botName } from '../config.js';

export interface CategoryInfo {
  index: number;
  name: string;
  displayName: string;
  description: string;
}

export const categories: CategoryInfo[] = [
  {
    index: 1,
    name: 'music',
    displayName: 'Music',
    description: `Play, pause, skip, and control music in your server.`,
  },
  {
    index: 2,
    name: 'info',
    displayName: 'Info',
    description: `Get information about ${botName} and its commands.`,
  },
  {
    index: 3,
    name: 'customisation',
    displayName: 'Customisation',
    description: `Personalise ${botName}'s appearance and behaviour in your server.`,
  },
  {
    index: 4,
    name: 'utility',
    displayName: 'Utility',
    description: 'Handy utility commands for everyday use.',
  },
  {
    index: 5,
    name: 'vcControls',
    displayName: 'VC Controls',
    description: 'Manage voice channel states — join, leave, mute, deafen, shift, and more.',
  },
];

/**
 * Category folder names (lowercased) whose commands are excluded from
 * the help menu entirely — not counted, not displayed, not selectable.
 */
export const excludedCategories: string[] = ['developer'];
