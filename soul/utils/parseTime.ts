// soul/utils/parseTime.ts
//
// Human-friendly time parser. Used by the `seek` command (and anything else
// that needs to accept duration input from chat).
//
// Accepted formats (case-insensitive, whitespace-tolerant):
//   "1m 45s"            "1  m 45 s"
//   "1minute 45seconds" "1min 45seconds" "1m 45second" "1min 45sec"
//   "1:45"              "1:30:45"          (h:m:s or m:s)
//   "1.45"              (dot, same as colon → m.s)
//   "105s"              "105seconds"       (raw seconds, may exceed 60)
//   "120"               (bare number → seconds)
//
// Validation rules:
//   • Hours and minutes must be 0-60.
//   • Seconds may be any non-negative number — they are NOT capped.
//     (e.g. `1m 70s`, `90s`, `1:90`, `1.90`, `120` all work.)
//   • Each unit may appear at most once in unit-suffixed form.

export class TimeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeParseError';
  }
}

const UNIT_MAP: Record<string, 'h' | 'm' | 's'> = {
  h: 'h', hr: 'h', hrs: 'h', hour: 'h', hours: 'h',
  m: 'm', min: 'm', mins: 'm', minute: 'm', minutes: 'm',
  s: 's', sec: 's', secs: 's', second: 's', seconds: 's',
};

const MAX_HM = 60;

/** Parse a time string into milliseconds. Throws `TimeParseError`. */
export function parseTime(raw: string): number {
  if (raw == null) throw new TimeParseError('No time provided.');
  const input = String(raw).trim().toLowerCase();
  if (!input) throw new TimeParseError('No time provided.');

  // ── Format A: H:M:S or M:S ─────────────────────────────────────────
  if (/^\d+(?::\d+){1,2}$/.test(input)) {
    const parts = input.split(':').map((p) => parseInt(p, 10));
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) [h, m, s] = parts as [number, number, number];
    else [m, s] = parts as [number, number];
    if (h > MAX_HM) throw new TimeParseError('Hours must be 0-60.');
    if (m > MAX_HM) throw new TimeParseError('Minutes must be 0-60.');
    return ((h * 60 + m) * 60 + s) * 1000;
  }

  // ── Format B: M.S (single dot — treated like colon) ───────────────
  if (/^\d+\.\d+$/.test(input)) {
    const [mStr, sStr] = input.split('.') as [string, string];
    const m = parseInt(mStr, 10);
    const s = parseInt(sStr, 10);
    if (m > MAX_HM) throw new TimeParseError('Minutes must be 0-60.');
    return (m * 60 + s) * 1000;
  }

  // ── Format C: unit-suffixed pairs ("1h 2m 3s", "105seconds", etc.) ─
  const compact = input.replace(/\s+/g, '');
  if (/[a-z]/.test(compact)) {
    const matches = [...compact.matchAll(/(\d+)([a-z]+)/g)];
    if (!matches.length) {
      throw new TimeParseError('Invalid time format.');
    }
    const consumed = matches.reduce((sum, m) => sum + m[0].length, 0);
    if (consumed !== compact.length) {
      throw new TimeParseError('Invalid time format.');
    }

    const values: { h: number; m: number; s: number } = { h: 0, m: 0, s: 0 };
    const seen = new Set<string>();
    for (const match of matches) {
      const value = parseInt(match[1] as string, 10);
      const unit = UNIT_MAP[match[2] as string];
      if (!unit) throw new TimeParseError(`Unknown unit "${match[2]}".`);
      if (seen.has(unit)) throw new TimeParseError(`Duplicate unit "${match[2]}".`);
      seen.add(unit);
      values[unit] = value;
    }

    if (values.h > MAX_HM) throw new TimeParseError('Hours must be 0-60.');
    if (values.m > MAX_HM) throw new TimeParseError('Minutes must be 0-60.');
    // Seconds may exceed 60 freely.
    return ((values.h * 60 + values.m) * 60 + values.s) * 1000;
  }

  // ── Format D: bare integer = seconds ──────────────────────────────
  if (/^\d+$/.test(input)) {
    return parseInt(input, 10) * 1000;
  }

  throw new TimeParseError('Invalid time format.');
}

/** Friendly help text appended after parser errors. */
export const TIME_FORMAT_HELP =
  'Try formats like `1m 45s`, `1:45`, `1.45`, `105s`, or `120`.';
