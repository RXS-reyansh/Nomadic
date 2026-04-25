// soul/structures/HermacaClient.ts
//
// Discord client wrapper. Construction is intentionally **silent** (no console
// output) so the boot block in `soul/hermaca.ts` can render lines in the exact
// order the startup spec defines. Each subsystem (database, kazagumo) has its
// own explicit `init*()` method so bootstrap can call them in spec order.
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { ClusterClient } from "discord-hybrid-sharding";
import { Kazagumo } from "kazagumo";
import { Connectors } from "shoukaku";
import { SimpleShardingStrategy } from "@discordjs/ws";
import config from "../config.js";
import logger from "../console/logger.js";
import {
  findBotInstanceByClientId,
  firstDisplayStatus,
  instanceUsesMobile,
} from "../config/botInstances.js";
import { StatusManager } from "./StatusManager.js";

function buildClientOptions() {
  const matched = findBotInstanceByClientId(process.env.DISCORD_CLIENT_ID);

  const baseOpts: any = {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
    rest: { timeout: 30000, retries: 3 },
    ws: {} as any,
  };

  if (matched && instanceUsesMobile(matched) && firstDisplayStatus(matched) === 'mobile') {
    baseOpts.ws.buildStrategy = (manager: any) => {
      manager.options.identifyProperties = {
        browser: 'Discord Android',
        os: 'android',
        device: 'discord-android',
      };
      return new SimpleShardingStrategy(manager);
    };
  }

  const initial = StatusManager.buildInitialPresenceFor(matched);
  if (initial) {
    baseOpts.ws.presence = {
      activities: initial.activities,
      status: initial.status,
      afk: false,
      since: null,
    };
  }

  return { matched, baseOpts };
}

export class HermacaClient extends Client {
  public cluster: ClusterClient;
  public config = config;
  public commands: Collection<string, any>;
  public slashCommands: Collection<string, any>;
  public aliases: Collection<string, string>;
  public cooldowns: Collection<string, number>;
  public stickyMessages: Map<string, string> = new Map();
  public kazagumo!: Kazagumo;
  public db: any;
  public helpers: any = {};
  public logger = logger;
  public webhookLogger: any;
  public statusManager!: StatusManager;
  public matchedInstance: ReturnType<typeof findBotInstanceByClientId>;

  /**
   * Set to `true` by bootstrap once the entire boot block has finished
   * printing. After this, runtime-emitted node-reconnect logs in
   * `soul/events/node/nodeConnect.ts` are allowed through.
   */
  public bootCompleted = false;

  constructor() {
    const { matched, baseOpts } = buildClientOptions();
    super(baseOpts);

    this.matchedInstance = matched;
    this.cluster = new ClusterClient(this as any);
    this.commands = new Collection();
    this.slashCommands = new Collection();
    this.aliases = new Collection();
    this.cooldowns = new Collection();
    // NOTE: no console output here — see file header.
  }

  /** Returns true if this instance is configured to identify as mobile. */
  usesMobileIndicator(): boolean {
    return !!(
      this.matchedInstance &&
      instanceUsesMobile(this.matchedInstance) &&
      firstDisplayStatus(this.matchedInstance) === 'mobile'
    );
  }

  /**
   * Initialise the database connection. Emits the four `[DATABASE] 🪐 ...`
   * lines from the boot spec. Must be called by bootstrap at the right point
   * in the boot order.
   */
  async initDatabase(buildName: string): Promise<void> {
    const { initDatabase } = await import("../database/database.js");
    this.db = await initDatabase(this.logger, buildName);
  }

  /**
   * Construct Kazagumo / Shoukaku and immediately begin connecting to all
   * configured Lavalink nodes. Stays silent — bootstrap prints the
   * `[LAVALINK]` and `[NODE]` lines itself in spec order.
   */
  initKazagumo(): void {
    this.kazagumo = new Kazagumo(
      {
        defaultSearchEngine: "youtube",
        send: (guildId: string, payload: any) => {
          const guild = this.guilds.cache.get(guildId);
          if (guild) guild.shard.send(payload);
        },
      },
      new Connectors.DiscordJS(this),
      config.nodes.map((node) => ({
        name: node.name,
        url: `${node.host}:${node.port}`,
        auth: node.auth,
        secure: node.secure || false,
      })),
      {
        moveOnDisconnect: false,
        resume: false,
        resumeTimeout: 30,
        reconnectTries: Infinity,
        restTimeout: 60,
      },
    );
  }
}
