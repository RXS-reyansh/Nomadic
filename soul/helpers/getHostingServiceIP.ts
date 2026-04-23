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
 * at startup. Resolves the provider name by:
 *  1. If config.hardcodeHostingService is non-empty, use that.
 *  2. Otherwise, match the fetched IP against soul/config/hostingServices.ts entries.
 *  3. If no match, fall back to "Local Host".
 *
 * Call this once during startup — the guard ensures it only logs once even if
 * called multiple times.
 */
export async function getHostingServiceIP(): Promise<void> {
  if (hasLogged) return;
  hasLogged = true;

  // If a hosting service name is hardcoded in config, use it without fetching IP
  if (config.hardcodeHostingService && config.hardcodeHostingService.trim().length > 0) {
    cachedProviderName = config.hardcodeHostingService.trim();
    logger.info('HOST', `Hosting service hardcoded as: ${cachedProviderName}`);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://ipinfo.io/json', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn('HOST', `Could not determine hosting IP (HTTP ${response.status}).`);
      return;
    }

    const data = (await response.json()) as IpInfoResponse;
    const ip = data.ip ?? 'unknown';

    // Check fetched IP against the configured list
    const matched = hostingServices.find(entry => entry.ip === ip);
    if (matched) {
      cachedProviderName = matched.name;
      logger.info('HOST', `${matched.name} — IP: ${ip}`);
    } else {
      cachedProviderName = 'Local Host';
      logger.info('HOST', `No match for IP ${ip} in hostingServices.ts — using "Local Host"`);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      logger.warn('HOST', 'Could not determine hosting IP (request timed out).');
    } else {
      logger.warn('HOST', `Could not determine hosting IP: ${(err as Error).message}`);
    }
  }
}
