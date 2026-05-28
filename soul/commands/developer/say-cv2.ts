// soul/commands/developer/say-cv2.ts
//
// Send a raw Components V2 JSON payload as the bot. Developer-only.
//
// The JSON body can be provided:
//   a) inline after the command name
//   b) as a text file attachment (useful for payloads > 2000 chars)
//
// The command message is always deleted after sending.
// If used as a reply, the bot replies to that message.

import { MessageFlags } from 'discord.js';
import { HermacaClient } from '../../structures/HermacaClient.js';
import { sendError } from '../../components/statusMessages.js';

export const options = {
  name: 'say-cv2',
  aliases: ['say-components', 'say-c'] as string[],
  description: 'Send a raw Components V2 JSON payload as the bot. (Developer only)',
  usage: `say-cv2 <json>
  say-cv2 (with a .json/.txt attachment)`,
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
  // Prefer commandRawArgs to preserve any whitespace / newlines in the JSON.
  let rawJson: string =
    typeof message.commandRawArgs === 'string' ? message.commandRawArgs.trim() : args.join(' ').trim();

  // If no inline JSON was given, try reading from the first text attachment.
  if (!rawJson && message.attachments?.size) {
    const attachment = message.attachments.first();
    const MAX_BYTES = 1_000_000;
    if (attachment.size > MAX_BYTES) {
      return sendError({ message }, `Attachment is too large (max ${MAX_BYTES.toLocaleString()} bytes).`);
    }
    try {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rawJson = (await res.text()).trim();
    } catch (err: any) {
      return sendError({ message }, `Failed to read attachment: \`${err.message}\``);
    }
    if (!rawJson) return sendError({ message }, 'The attached file is empty.');
  }

  if (!rawJson) {
    return sendError({ message }, 'Provide a Components V2 JSON payload, or attach a file.');
  }

  // Validate JSON.
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    return sendError({ message }, `Invalid JSON:\n\`${err.message}\``);
  }

  const sendPayload: any = {
    components: Array.isArray(parsed) ? parsed : [parsed],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };

  await message.delete().catch((): null => null);

  // Reply-threading: if the command was a reply, post as a reply to that message.
  if (message.reference?.messageId) {
    const replied = await message.channel.messages
      .fetch(message.reference.messageId)
      .catch((): null => null);
    if (replied) {
      await replied.reply(sendPayload).catch((): Promise<any> => message.channel.send(sendPayload));
      return;
    }
  }

  const sent = await message.channel.send(sendPayload).catch((): null => null);
  if (!sent) {
    // Channel.send failed — the JSON structure was likely rejected by Discord.
    // Command message is already gone so surface error as a temporary message.
    const errMsg = await sendError(
      { channel: message.channel },
      'Discord rejected the Components V2 payload. Check your JSON structure.',
    );
    if (errMsg) setTimeout(() => (errMsg as any).delete().catch((): null => null), 8000);
  }
}
