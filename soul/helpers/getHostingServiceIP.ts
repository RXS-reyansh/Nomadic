// soul/helpers/getHostingServiceIP.ts
import logger from '../console/logger.js';
import config from '../config.js';
import { hostingServices } from '../config/hostingServices.js';

let hasLogged = false;
let cachedProviderName = 'Local Host';

/** Returns the cached hosting provider name, available after getHostingServiceIP() has run. */
export function getHostingProviderName(): string {
  return cachedProviderName;
}

interface IpInfoResponse {
  ip?: string;
  org?: string;
  hostname?: string;
}

/**
 * Fetches the public IP of the hosting machine from ipinfo.io and logs it once
 * at startup. Provider resolution:
 *  1. If `config.hardcodeHostingService` is non-empty, use that name (and still
 *     log the IP if the lookup succeeds — pure cosmetic, the matching is
 *     skipped).
 *  2. Otherwise match the fetched IP against `soul/config/hostingServices.ts`.
 *  3. Fall back to "Local Host".
 *
 * Output format (boot-block spec):
 *   [HOST] 🌐 Hosting service IP: <ip>/32
 *   [HOST] 🌐 Hosting service hardcoded as: <name>     ← only if hardcoded
 *
 * The /32 mask is hardcoded per spec.
 */
export async function getHostingServiceIP(): Promise<void> {
  if (hasLogged) return;
  hasLogged = true;

  let ip: string | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://ipinfo.io/json', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (response.ok) {
      const data = (await response.json()) as IpInfoResponse;
      ip = data.ip ?? null;
    }
  } catch {
    ip = null;
  }

  if (ip) {
    logger.info('HOST', `🌐 Hosting service IP: ${ip}/32`);
  } else {
    logger.warn('HOST', `🌐 Hosting service IP: unknown/32`);
  }

  // Resolve display name
  if (config.hardcodeHostingService && config.hardcodeHostingService.trim().length > 0) {
    cachedProviderName = config.hardcodeHostingService.trim();
    logger.info('HOST', `🌐 Hosting service hardcoded as: ${cachedProviderName}`);
    return;
  }

  if (ip) {
    const matched = hostingServices.find(entry => entry.ip === ip);
    if (matched) {
      cachedProviderName = matched.name;
      logger.info('HOST', `🌐 Hosting service detected: ${matched.name}`);
    } else {
      cachedProviderName = 'Local Host';
      logger.info('HOST', `🌐 No match for IP — using "Local Host"`);
    }
  }
}
