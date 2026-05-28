// soul/helpers/devTimeTweak.ts
//
// Flexible time-expression parser used by the developer-only `special-afk`
// command. Parses a single value across four formats:
//
//   1. Discord timestamp        `<t:1735689600>`, `<t:1735689600:R>`,
//                               `<t:-1234567890>`  (signed, large bounds)
//   2. Bare unix integer        `1735689600` (seconds, 1-11 digits)
//                               `1735689600000` (milliseconds, 12-14 digits)
//                               sign optional (`-1735689600` works)
//   3. Relative duration        `1h`, `+1h`, `-1h`, `1.5h`, `30m`,
//                               `1d12h30m`, `1y2mo3w4d5h6m7s`, `500ms`
//                               Units (case-insensitive):
//                                 ms, s, m/min, h/hr, d/day, w/wk,
//                                 mo (months=30d), y (years=365.25d)
//                               Sign sets direction: `-` past, `+` (or none) future.
//   4. ISO date / RFC 3339      `2025-12-31`,
//                               `2025-12-31T18:00:00Z`,
//                               `2025-12-31T18:00:00+05:30`
//
// All values are clamped to JavaScript Date's safe range (±8.64e15 ms ≈
// ±273,000 years from epoch). Anything beyond that is pinned to the
// boundary, never silently dropped.

const SAFE_MS = 8.64e15;

export function parseTimeExpression(raw: string, now: Date = new Date()): Date | null {
  const v = (raw ?? '').trim();
  if (!v) return null;

  // a) Discord timestamp <t:N> or <t:N:f>
  const discordTs = v.match(/^<t:(-?\d{1,16})(?::[tTdDfFR])?>$/);
  if (discordTs) return unixSecondsToDate(Number(discordTs[1]));

  // b) Relative duration with required unit suffix (`1h`, `-1h`, `1d12h30m`, `1.5h`).
  //    Detected when the value contains AT LEAST ONE letter and matches the
  //    duration grammar end-to-end.
  if (/[a-zA-Z]/.test(v)) {
    const ms = parseRelativeDurationMs(v);
    if (ms !== null) return clampDate(now.getTime() + ms);
  }

  // c) Bare signed integer — auto-classify by digit count.
  //    1-11 digits → seconds; 12-14 digits → milliseconds.
  const intMatch = v.match(/^-?\d+$/);
  if (intMatch) {
    const digits = v.replace(/^-/, '').length;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (digits >= 12 && digits <= 14) return clampDate(n);
    return clampDate(n * 1000);
  }

  // d) ISO 8601 / RFC 3339 / slash-separated dates / anything Date.parse() accepts.
  //    Require at least one digit AND one of `-`, `T`, `:`, `/` to avoid
  //    swallowing nonsense. The slash branch covers M/D/YY, M/D/YYYY,
  //    YYYY/MM/DD, etc. (V8 / Date.parse handle these natively).
  if (/\d/.test(v) && /[-T:/]/.test(v)) {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return clampDate(parsed);
  }

  return null;
}

// ── Relative duration ─────────────────────────────────────────────────────

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
  w: 604_800_000,
  wk: 604_800_000,
  wks: 604_800_000,
  week: 604_800_000,
  weeks: 604_800_000,
  mo: 2_592_000_000, // 30 days
  mon: 2_592_000_000,
  mos: 2_592_000_000,
  month: 2_592_000_000,
  months: 2_592_000_000,
  y: 31_557_600_000, // 365.25 days
  yr: 31_557_600_000,
  yrs: 31_557_600_000,
  year: 31_557_600_000,
  years: 31_557_600_000,
};

/**
 * Parse a signed compact relative duration into milliseconds.
 *   `1h`, `+1h`, `-1h`, `1.5h`, `1d12h30m`, `1y2mo3w4d5h6m7s`, `500ms`
 * Returns null if the input doesn't fully match the grammar.
 */
export function parseRelativeDurationMs(raw: string): number | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;

  let sign = 1;
  if (s[0] === '+' || s[0] === '-') {
    if (s[0] === '-') sign = -1;
    s = s.slice(1);
  }
  if (!s) return null;

  // Strip whitespace inside the duration so "1d 12h 30m" works too.
  const compact = s.replace(/\s+/g, '');

  // Walk number+unit pairs greedily. Numbers may be decimal ("1.5h").
  const re = /(\d+(?:\.\d+)?)([a-z]+)/g;
  let total = 0;
  let consumed = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(compact)) !== null) {
    const value = parseFloat(match[1]);
    const unitKey = match[2];
    const unitMs = UNIT_MS[unitKey];
    if (unitMs === undefined) return null;
    if (!Number.isFinite(value)) return null;
    total += value * unitMs;
    consumed += match[0].length;
  }
  if (consumed === 0 || consumed !== compact.length) return null;

  return sign * total;
}

// ── Internals ─────────────────────────────────────────────────────────────

function unixSecondsToDate(seconds: number): Date | null {
  if (!Number.isFinite(seconds)) return null;
  return clampDate(seconds * 1000);
}

function clampDate(ms: number): Date | null {
  if (!Number.isFinite(ms)) return null;
  // JavaScript Date safe range is ±8,640,000,000,000,000 ms (~273k years).
  if (Math.abs(ms) > SAFE_MS) {
    ms = ms > 0 ? SAFE_MS : -SAFE_MS;
  }
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
