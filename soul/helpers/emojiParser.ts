// soul/helpers/emojiParser.ts
//
// Handles the $emoji<name_or_id> syntax used in the say command.
//
// Rules:
//   $emojyfoo          → resolved emoji for "foo"
//   $emojyfoo|$|$emojybar → resolved emoji "foo" immediately followed by emoji "bar" (no space)
//   $emojyfoo $emojybar   → emoji "foo" + space + emoji "bar"
//
// The identifier after $emoji ends at: whitespace | pipe `|` | dollar `$` | end of string.
// After all replacements, bare |$| separators are stripped (they become zero-width joiners).

const SAY_EMOJI_REGEX = /\$emoji(?:<([^>\s|$]+)>|([^\s|$]+))/g;
const NO_SPACE_SEP = /\|\$\|/g;

export interface ParseResult {
  text: string;
  invalid: string[];
}

export async function parseSayText(
  raw: string,
  resolve: (identifier: string) => Promise<any | null>,
): Promise<ParseResult> {
  const invalid: string[] = [];

  SAY_EMOJI_REGEX.lastIndex = 0;

  const matches: Array<{ full: string; identifier: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = SAY_EMOJI_REGEX.exec(raw)) !== null) {
    matches.push({ full: m[0], identifier: m[1] ?? m[2] });
  }

  if (matches.length === 0) {
    return { text: raw, invalid };
  }

  const replacements = new Map<string, string>();
  await Promise.all(
    matches.map(async ({ full, identifier }) => {
      if (replacements.has(full)) return;
      const emoji = await resolve(identifier);
      if (emoji) {
        replacements.set(full, emoji.toString());
      } else {
        invalid.push(identifier);
        replacements.set(full, '');
      }
    }),
  );

  let result = raw;
  for (const [full, replacement] of replacements) {
    result = result.split(full).join(replacement);
  }

  result = result.replace(NO_SPACE_SEP, '');

  return { text: result, invalid };
}
