// soul/events/node/nodeConnect.ts
// Shoukaku event: 'ready' — fires when a node connects (first connection or
// resume). Attached to client.kazagumo.shoukaku (type: 'node').
//
// IMPORTANT: For the very first node connect during boot we deliberately stay
// silent on the console — `bootstrap()` in soul/hermaca.ts logs the
// "[NODE] ✅ Lavalink node X connected!" line itself so it appears in the
// correct position in the boot block. Once boot is fully complete
// (`client.bootCompleted === true`), reconnects log normally.
import logger from '../../console/logger.js';
import webhookLogger from '../../utils/webhookLogger.js';

export const name = 'ready';
export const type = 'node';

export const execute = (client: any, name: string, resumed: boolean): void => {
  if (resumed) {
    logger.success('NODE', `🔄 Lavalink node "${name}" resumed session.`);
    webhookLogger.logNode('reconnect', name);
    return;
  }

  webhookLogger.logNode('connect', name);

  // Suppress the initial connect log during the boot block — bootstrap
  // prints it inline at the right moment. Subsequent fresh connects
  // (e.g. node went down and came back without a resume) log normally.
  if (client.bootCompleted) {
    logger.success('NODE', `✅ Lavalink node "${name}" connected!`);
  }
};
