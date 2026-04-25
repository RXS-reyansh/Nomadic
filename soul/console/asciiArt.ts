// soul/console/asciiArt.ts
//
// Renders the boot ASCII art as a vertical gradient. Reads
// `soul/console/ascii.txt` from this folder and colors each line by
// interpolating between the four stops in `asciiPalette` (color-config.ts).

import { readFileSync } from 'fs';
import { join } from 'path';
import { asciiPalette } from './color-config.js';

const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';

function blendColors(hex1: string, hex2: string, ratio: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function hexToAnsi(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** Builds an 8-step gradient from the 4-stop ASCII palette. */
function getGradientColors(): string[] {
  const [c1, c2, c3, c4] = asciiPalette;
  return [
    c1,
    blendColors(c1, c2, 0.33),
    blendColors(c1, c2, 0.66),
    c2,
    blendColors(c2, c3, 0.5),
    c3,
    blendColors(c3, c4, 0.5),
    c4,
  ];
}

/**
 * Reads `reference/ascii.txt` and prints it line-by-line with a vertical
 * gradient. Silent no-op if the file isn't found (the boot block continues
 * normally).
 */
export function displayAsciiArt(): void {
  let raw = '';
  try {
    raw = readFileSync(join(process.cwd(), 'soul', 'console', 'ascii.txt'), 'utf8');
  } catch {
    return;
  }

  // Trim trailing blank lines but keep internal blank lines intact.
  const lines = raw.replace(/\s+$/, '').split('\n');
  const gradient = getGradientColors();

  for (let i = 0; i < lines.length; i++) {
    const colorIndex = Math.min(i, gradient.length - 1);
    const color = hexToAnsi(gradient[colorIndex]);
    console.log(`${color}${BRIGHT}${lines[i]}${RESET}`);
  }
}
