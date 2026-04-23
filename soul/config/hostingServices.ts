// soul/config/hostingServices.ts
//
// Map your hosting service IPs to display names.
// At startup, the bot fetches its public IP and checks against this list.
// If a match is found, that name is used as the "Powered by" label everywhere.
// If no match is found, "Local Host" is shown instead.
//
// This file is ignored entirely if `hardcodeHostingService` in config.ts is non-empty.
//
// Example:
//   { name: 'Hetzner',         ip: '65.21.4.9'    },
//   { name: 'Replit',          ip: '34.145.0.0'   },
//   { name: 'DigitalOcean',    ip: '167.99.0.0'   },

export interface HostingServiceEntry {
  name: string;
  ip: string;
}

export const hostingServices: HostingServiceEntry[] = [
  // Add your entries here:
  // { name: 'Service Name', ip: '0.0.0.0' },
];
