// soul/events/discord/raw.ts
// With Kazagumo + Connectors.DiscordJS, the connector automatically handles
// voice state packet forwarding to Shoukaku — this file is intentionally a no-op.
export const name = 'raw';
export const type = 'discord';

export async function execute(_client: any, _packet: any): Promise<void> {
  // No-op: Shoukaku's DiscordJS connector handles voice packets automatically.
}
