// index.ts — top-level cluster manager
//
// Renders the ASCII art + first [CLUSTER] block per the boot spec, then spawns
// the cluster process(es). The actual bot bootstrap (login, DB, loaders, etc.)
// runs inside each cluster process via `soul/hermaca.ts`.
import { ClusterManager } from 'discord-hybrid-sharding';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import logger from './soul/console/logger.js';
import { displayAsciiArt } from './soul/console/asciiArt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN environment variable is not set');
  process.exit(1);
}

// ── Boot block: divider + ASCII art ─────────────────────────────────────────
logger.line();
displayAsciiArt();

const manager = new ClusterManager(join(__dirname, 'soul', 'hermaca.js'), {
  token,
  totalShards: 'auto',
  shardsPerClusters: 2,
  totalClusters: 'auto',
  mode: 'process',
  restarts: { interval: 120000, max: 3 },
  respawn: true,
});

// Each clusterCreate fires once per cluster. We emit two lines per cluster
// (per the startup spec) and then a divider. Multiple clusters produce
// multiple paired blocks separated by dividers.
manager.on('clusterCreate', (cluster) => {
  const shardList: number[] = (cluster as any).shardList ?? [];
  const totalClusters = manager.totalClusters ?? 1;
  const shardsLabel =
    shardList.length === 0
      ? '?'
      : shardList.length === 1
        ? `shard ${shardList[0]}`
        : `shards ${shardList.join(', ')}`;
  const clustersLabel = `${totalClusters} cluster${totalClusters > 1 ? 's' : ''} total`;

  logger.info('CLUSTER', `☄️ Cluster #${cluster.id} created`);
  logger.info('CLUSTER', `☄️ Manages ${shardsLabel} (${clustersLabel})`);
  logger.line();
});

manager.on('clusterError', (cluster, error) => {
  logger.error('CLUSTER', `Cluster #${cluster.id} error: ${error.message}`);
});

// `clusterReady` is intentionally NOT logged — the cluster's own bootstrap
// already prints CLIENT/SHARD/YAY lines. Logging here just adds noise.

manager.on('clusterExit', (cluster, code, signal) => {
  logger.warn('CLUSTER', `Cluster #${cluster.id} exited | Code: ${code} | Signal: ${signal}`);
});

async function fireErrorWebhook(title: string, description: string): Promise<void> {
  const url = process.env.ERROR_LOG_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Hermaca Pre-flight',
        embeds: [
          {
            title: `🚫 ${title}`,
            description,
            color: 0xed4245,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch {
    // Webhook delivery failed — nothing we can do at this stage; the console
    // line was already printed by the caller, so we just swallow it.
  }
}

async function preflightGatewayCheck(botToken: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch('https://discord.com/api/v10/gateway/bot', {
      headers: { Authorization: `Bot ${botToken}` },
    });
  } catch (err: any) {
    logger.warn(
      'CLUSTER',
      `Pre-flight /gateway/bot check skipped (network error: ${err?.message ?? err}). Continuing to spawn.`,
    );
    return;
  }

  if (res.ok) return;

  const status = res.status;
  const bodyText = await res.text().catch((): string => '');
  const server = res.headers.get('server') ?? '';
  const isCloudflareEdge = /cloudflare/i.test(server);

  let title: string;
  let consoleMsg: string;

  if (status === 401) {
    title = 'Invalid Discord token';
    consoleMsg =
      'DISCORD_TOKEN is invalid (401 Unauthorized). Check the token in your env / hosting panel.';
  } else if (status === 429 && isCloudflareEdge && /\b1015\b/.test(bodyText)) {
    title = 'Hosting IP Cloudflare-rate-limited (1015)';
    consoleMsg =
      'Hosting IP is Cloudflare-rate-limited (error 1015). Token, code, and config are not at fault — contact your host to move nodes, or wait without restarting.';
  } else if (status === 429) {
    let retryHint = '';
    try {
      const j = JSON.parse(bodyText) as { retry_after?: number; global?: boolean };
      if (typeof j.retry_after === 'number') {
        retryHint = ` Retry after ~${Math.ceil(j.retry_after)}s${j.global ? ' (global)' : ''}.`;
      }
    } catch {
      // not JSON — leave retryHint empty
    }
    title = 'Token rate-limited at /gateway/bot';
    consoleMsg = `Discord rate-limited the token at /gateway/bot (429).${retryHint} Likely caused by too many recent restarts — stop restarting and wait it out.`;
  } else {
    title = `Pre-flight failed (HTTP ${status})`;
    consoleMsg = `Pre-flight /gateway/bot failed: HTTP ${status}. Body: ${bodyText.slice(0, 200)}`;
  }

  logger.error('CLUSTER', consoleMsg);
  await fireErrorWebhook(title, consoleMsg);
  process.exit(1);
}

await preflightGatewayCheck(token);

manager.spawn({ timeout: -1 }).catch((error) => {
  logger.error('CLUSTER', `Failed to spawn clusters: ${error.message}`);
  process.exit(1);
});
