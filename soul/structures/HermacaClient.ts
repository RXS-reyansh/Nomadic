// soul/structures/HermacaClient.ts
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

// Compute the matched instance once at module load — the constructor needs it
// before super() can be called, and a static helper keeps that constructor
// (which can't reference `this` before super) clean.
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
    // The IDENTIFY browser/os/device controls the device-icon next to the bot.
    // discord.js v14 ignores `options.ws.properties` (the new `@discordjs/ws`
    // hardcodes its defaults). The only reliable hook is `buildStrategy`,
    // which lets us mutate `manager.options.identifyProperties` BEFORE the
    // sharding strategy is constructed — at which point the shard reads it
    // and forwards it in the IDENTIFY payload.
    baseOpts.ws.buildStrategy = (manager: any) => {
      manager.options.identifyProperties = {
        browser: 'Discord Android',
        os: 'android',
        device: 'discord-android',
      };
      return new SimpleShardingStrategy(manager);
    };
  }

  // Apply initial presence at IDENTIFY so the status appears the moment the
  // gateway is up — eliminates the "presence appears late" delay of waiting
  // for the ready event.
  //
  // IMPORTANT: discord.js's `Client#login` runs `options.presence` through
  // `ClientPresence._parse`, which strips unknown activity fields including
  // `emoji` and `state`. To preserve custom-emoji support and the proper
  // ActivityType.Custom shape, we set `options.ws.presence` DIRECTLY to a
  // raw gateway-shaped dict and leave `options.presence` undefined so login
  // doesn't overwrite it.
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
  // Sticky message in-memory cache. Key is `${guildId}-${channelId}`. Value
  // holds the most-recently-sent sticky message ID so messageCreate can skip
  // re-sending when the incoming message IS the bot's own sticky (loop guard).
  public stickyMessages: Map<string, string> = new Map();
  public kazagumo!: Kazagumo;
  public db: any;
  public helpers: any = {};
  public logger = logger;
  public webhookLogger: any;
  public statusManager!: StatusManager;

  constructor() {
    const { matched, baseOpts } = buildClientOptions();
    super(baseOpts);

    this.cluster = new ClusterClient(this as any);
    this.commands = new Collection();
    this.slashCommands = new Collection();
    this.aliases = new Collection();
    this.cooldowns = new Collection();

    if (matched && instanceUsesMobile(matched) && firstDisplayStatus(matched) === 'mobile') {
      logger.info('STATUS', `Mobile device indicator enabled for clientId ${matched.clientId}.`);
    }
  }

  async loadModules(): Promise<void> {
    logger.info("LOADER", "Loading modules...");

    await this.loadDatabase();
    await this.loadMusic();
    await this.loadEvents();
    await this.loadHelpers();
    await this.loadCommands();

    logger.success("LOADER", "All modules loaded");
  }

  private async loadDatabase(): Promise<void> {
    const { initDatabase } = await import("../database/database.js");
    this.db = await initDatabase(this.logger);
    logger.success("DATABASE", "Connected");
  }

  private async loadMusic(): Promise<void> {
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

    logger.success("LAVALINK", "Kazagumo music system initialized");
  }

  private async loadEvents(): Promise<void> {
    const { loadAllEvents } = await import("../handlers/eventLoader.js");
    await loadAllEvents(this);
  }

  private async loadHelpers(): Promise<void> {
    const { loadHelpers } = await import("../handlers/helperLoader.js");
    this.helpers = await loadHelpers(this);
  }

  private async loadCommands(): Promise<void> {
    const { loadPrefixCommands } = await import("../handlers/commandLoader.js");
    await loadPrefixCommands(this);

    const { loadSlashCommands } = await import("../handlers/slashLoader.js");
    await loadSlashCommands(this);
  }
}
