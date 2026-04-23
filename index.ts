// index.ts
import { ClusterManager } from 'discord-hybrid-sharding';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple logger matching aether/console/logger style
const log = (tag: string, message: string, isError = false) => {
  const finalTag = isError ? `${tag}-ERROR` : tag;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`${timestamp} [${finalTag}] ${message}`);
};

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN environment variable is not set');
  process.exit(1);
}

const manager = new ClusterManager(join(__dirname, 'soul', 'hermaca.js'), {
  token, // ✅ Now guaranteed to be string, not string | undefined
  totalShards: 'auto',
  shardsPerClusters: 2,
  totalClusters: 'auto',
  mode: 'process',
  restarts: {
    interval: 120000,
    max: 3,
  },
  respawn: true,
});

manager.on('clusterCreate', (cluster) => {
  log('CLUSTER', `Cluster #${cluster.id} created`);
});

manager.on('clusterError', (cluster, error) => {
  log('CLUSTER', `Cluster #${cluster.id} error: ${error.message}`, true);
});

manager.on('clusterReady', (cluster) => {
  log('CLUSTER', `Cluster #${cluster.id} ready`);
});

manager.on('clusterExit', (cluster, code, signal) => {
  log('CLUSTER', `Cluster #${cluster.id} exited | Code: ${code} | Signal: ${signal}`);
});

manager.spawn({ timeout: -1 }).catch((error) => {
  log('CLUSTER', `Failed to spawn clusters: ${error.message}`, true);
  process.exit(1);
});