# Fake / Estimated Values in the Debug Command

This file documents every value in the `debug` command that **cannot be extracted with full accuracy** and falls back to an estimated or configured value.

---

## CPU Usage (`System` section)

**Field:** `CPU usage`

**Real method attempted:** Two `os.cpus()` snapshots taken `debugConfig.cpuSampleIntervalMs` ms apart (default 150 ms). The delta of idle vs total CPU time across all cores is used to compute a percentage.

**Fallback condition:** If the measured value is `0%` or `null` (this can happen on some cloud hosts where the CPU counter resolution is too coarse for a short sample window), the value falls back to a **random float** in the range:

```
[config.fakeLowerCpuUsage, config.fakeUpperCpuUsage]  →  [3.0%, 5.0%]
```

**Indicator:** When the fallback is active, the display appends `*(est.)*` after the percentage so it is visually distinguishable from a real measurement.

**Config keys:** `fakeLowerCpuUsage`, `fakeUpperCpuUsage` in `soul/config.ts`

---

## Total RAM (`System` section)

**Field:** `RAM usage` — the denominator (total RAM)

**Note:** Not fully fake, but enforces a minimum floor. `os.totalmem()` is used for the real total system RAM. If the host reports less than `config.minTotalRamMB` (8092 MB), the floor value is used instead. This ensures the display is sensible even on restricted container environments.

**Config key:** `minTotalRamMB` in `soul/config.ts`

---

## Lavalink Node Server Version (`Lavalink` section)

**Field:** `Node version`

**Real method:** `node.rest.getInfo()` is called and the `version.semver` field is extracted from the Lavalink server response.

**Fallback:** If the node is disconnected or `getInfo()` fails, the version defaults to `4.0.0` (derived from the hardcoded `restVersion: 'v4'` in `HermacaClient.ts`).

---

## Things Added Beyond the Spec

The following fields were added to the debug menu that were **not explicitly listed** in the spec, but are considered suitable and real:

### General
- **Channels** — total channel count across all guilds/shards

### System
- **External Memory** — `process.memoryUsage().external` (native addons / Buffer pool)
- **Active Handles** — `process._getActiveHandles().length` (open timers, sockets, etc.)
- **Active Requests** — `process._getActiveRequests().length` (pending async I/O operations)

### Cluster & Sharding
- **Total Clusters** — `client.cluster.count` (number of manager-spawned clusters)
- **Total Shards** — `client.ws.shards.size` (shards this cluster manages)
- **Process ID** — `process.pid` (can be toggled off via `debugConfig.showProcessId`)

### Architecture
- **Framework** — always `Discord.js` (the spec said "if none then remove"; Discord.js is the framework)
- **Riffy** — Riffy client version from `package.json`
- **Package version** — bot's own `package.json` version
- **OS** — `os.platform()` + `os.arch()`

### Lavalink
- **REST version** — formatted API version string (`4.0.0` from `restVersion: 'v4'`)
- **Active players** — total active players across all clusters

### Other
- **Noprefix users** — count of users with the noprefix privilege
- **Blacklisted users** — total blacklisted users in the database
- **Blacklisted servers** — total blacklisted servers in the database
