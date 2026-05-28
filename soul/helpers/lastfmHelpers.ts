// soul/helpers/lastfmHelpers.ts
//
// Common parsing / resolution helpers used by every fm* command.

import type { HermacaClient } from '../structures/HermacaClient.js';
import { resolveUser } from './userResolver.js';

/** Valid Last.fm period strings, plus user-friendly aliases. */
const PERIOD_ALIASES: Record<string, string> = {
  '7day': '7day',
  'week': '7day',
  '1week': '7day',
  'weekly': '7day',
  '1month': '1month',
  'month': '1month',
  'monthly': '1month',
  '3month': '3month',
  '3months': '3month',
  'quarter': '3month',
  '6month': '6month',
  '6months': '6month',
  'half': '6month',
  '12month': '12month',
  '12months': '12month',
  'year': '12month',
  'yearly': '12month',
  '1year': '12month',
  'overall': 'overall',
  'all': 'overall',
  'alltime': 'overall',
  'lifetime': 'overall',
};

export const VALID_PERIODS = ['7day', '1month', '3month', '6month', '12month', 'overall'] as const;
export type LastfmPeriod = typeof VALID_PERIODS[number];

export function isPeriodToken(token: string): boolean {
  return token.toLowerCase() in PERIOD_ALIASES;
}

export function parsePeriod(token: string | undefined, fallback: LastfmPeriod = '7day'): LastfmPeriod {
  if (!token) return fallback;
  return (PERIOD_ALIASES[token.toLowerCase()] as LastfmPeriod) ?? fallback;
}

/** Friendly name for a period, used in panel titles. */
export function periodLabel(p: LastfmPeriod): string {
  switch (p) {
    case '7day': return 'last 7 days';
    case '1month': return 'last month';
    case '3month': return 'last 3 months';
    case '6month': return 'last 6 months';
    case '12month': return 'last 12 months';
    case 'overall': return 'all time';
  }
}

/**
 * Loose argument parser used by every command that accepts `[@user] [period]
 * [limit]` in any order. Pulls the first user-like token, the first period
 * token, and the first numeric token from `args`. Anything not consumed is
 * returned in `rest`.
 */
export interface ParsedArgs {
  userArg: string | null;
  period: LastfmPeriod | null;
  limit: number | null;
  rest: string[];
}

export function parseLooseArgs(args: string[]): ParsedArgs {
  let userArg: string | null = null;
  let period: LastfmPeriod | null = null;
  let limit: number | null = null;
  const rest: string[] = [];
  for (const tok of args) {
    if (!userArg && (/^<@!?\d+>$/.test(tok) || /^\d{17,20}$/.test(tok))) {
      userArg = tok;
      continue;
    }
    if (!period && isPeriodToken(tok)) {
      period = parsePeriod(tok);
      continue;
    }
    if (limit === null && /^\d{1,3}$/.test(tok)) {
      const n = parseInt(tok, 10);
      if (n > 0 && n <= 100) {
        limit = n;
        continue;
      }
    }
    rest.push(tok);
  }
  return { userArg, period, limit, rest };
}

export interface TargetResolution {
  /** Discord user the command is targeting (the requester or someone else). */
  discordUser: any;
  /** Their linked Last.fm username, or null if not linked. */
  lastfmUsername: string | null;
  /** True if the requester is targeting themselves. */
  isSelf: boolean;
}

/**
 * Resolve the Discord user this command is acting on (mention/ID arg or self),
 * then look up their Last.fm link in the DB. Returns `lastfmUsername: null`
 * when the target hasn't linked an account.
 */
export async function resolveTarget(
  client: HermacaClient,
  guild: any,
  requester: any,
  userArg: string | null,
): Promise<TargetResolution> {
  let discordUser = requester;
  if (userArg) {
    const resolved = await resolveUser(client, guild, userArg);
    if (resolved) discordUser = resolved;
  }
  const lastfmUsername = await client.db.getLastfmUsername(discordUser.id);
  return {
    discordUser,
    lastfmUsername,
    isSelf: discordUser.id === requester.id,
  };
}

/** Format a Last.fm UTS timestamp (seconds) as a Discord relative timestamp. */
export function uts(t: string | number | undefined): string {
  const n = typeof t === 'string' ? parseInt(t, 10) : (t ?? 0);
  if (!n) return '';
  return `<t:${n}:R>`;
}

/** Compact integer formatter — `1234567` → `1,234,567`. */
export function fmt(n: number | string | undefined): string {
  const v = typeof n === 'string' ? parseInt(n, 10) : (n ?? 0);
  if (!isFinite(v)) return '0';
  return v.toLocaleString('en-US');
}

/**
 * Sanitize a string for use inside a Discord markdown link. Last.fm titles
 * routinely contain `[`, `]`, `(`, `)` which would break `[label](url)`.
 */
export function safeLinkLabel(s: string): string {
  return (s ?? '').replace(/[\[\]]/g, '').trim() || '—';
}
