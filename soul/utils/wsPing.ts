// soul/utils/wsPing.ts
//
// Resolves a sensible WebSocket ping value for the running client.
//
// `client.ws.ping` returns -1 when no heartbeat ACK has been received yet.
// In hybrid-sharded clusters the manager-level average can stay at -1 for
// a while even after individual shards report valid pings. This helper
// walks every available source and falls back to the API round-trip
// latency so the ping/debug menus never show "N/A" for a healthy bot.

export function resolveWsPing(client: any, fallbackMs?: number): number | null {
  const main = Math.round(client?.ws?.ping ?? -1);
  if (main >= 0) return main;

  const shards: any = client?.ws?.shards;
  if (shards) {
    const values =
      typeof shards.values === 'function'
        ? [...shards.values()]
        : typeof shards.first === 'function'
          ? [shards.first()]
          : [];
    for (const s of values) {
      const p = (s as any)?.ping;
      if (typeof p === 'number' && p >= 0) return Math.round(p);
    }
  }

  if (typeof fallbackMs === 'number' && fallbackMs >= 0) return Math.round(fallbackMs);
  return null;
}
