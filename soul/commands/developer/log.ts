import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendSuccess } from '../../components/statusMessages.js';
import { sendWrongUsage } from '../../components/wrongUsage.js';

export const options = {
  name: 'log',
  aliases: [] as string[],
  description: 'Log text to the console. (Developer only)',
  usage: 'log <text>',
  category: 'developer',
  isDeveloper: true,
  userPerms: [] as string[],
  botPerms: [] as string[],
  player: false,
  inVoiceChannel: false,
  sameVoiceChannel: false,
  cooldown: 0,
};

export async function prefixExecute(message: any, args: string[], client: HermacaClient) {
  if (!args.length) return sendWrongUsage({ message, client }, options.name, options.usage);

  // Extract raw text from message.content to preserve actual newlines
  // message.content starts with the prefix+command token, e.g. "$$log text here"
  const firstWsMatch = message.content.match(/^\S+\s+/);
  const rawText = firstWsMatch ? message.content.slice(firstWsMatch[0].length) : args.join(' ');

  const lines: string[] = rawText
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean);

  if (!lines.length) return sendWrongUsage({ message, client }, options.name, options.usage);

  for (const line of lines) {
    client.logger.developerLog(line);
  }

  const quoted = lines.map((l: string) => `> ${l}`).join('\n');
  await sendSuccess({ message }, `Logged to console:\n${quoted}`);
}
