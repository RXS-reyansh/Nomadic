// aether/database/database.ts
import { MongoClient, Db, Collection, Document } from 'mongodb';

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

interface Logger {
  info: (tag: string, msg: string) => void;
  error: (tag: string, msg: string) => void;
  success: (tag: string, msg: string) => void;
  warn?: (tag: string, msg: string) => void;
}

interface AFKEntry {
  user_id: string;
  guild_id?: string | null;
  scope: 'server' | 'global';
  reason: string;
  image_url: string | null;
  since_at: Date;
  till_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface GuildPrefixDoc {
  guild_id: string;
  prefix: string;
}

interface TwentyFourSevenDoc {
  guild_id: string;
  channelId: string;
  enabled: boolean;
}

interface UserStatsDoc {
  discord_user_id: string;
  totalPlays: number;
  totalListeningTime: number;
  songs: any[];
  artists: any[];
  lastUpdated: Date;
}

interface NoPrefixUserDoc {
  user_id: string;
  addedAt: Date;
  addedBy?: string;
}

interface NoPrefixDisabledGuildDoc {
  guild_id: string;
  disabledAt: Date;
  disabledBy?: string;
}

interface BlacklistUserDoc {
  user_id: string;
  addedAt: Date;
  addedBy?: string;
}

interface BlacklistServerDoc {
  guild_id: string;
  addedAt: Date;
  addedBy?: string;
}

// ----------------------------------------------------------------------
// Database Class
// ----------------------------------------------------------------------

export class Database {
  private client: MongoClient;
  private db: Db | null = null;
  private connected = false;
  private readonly botId: string;
  private logger: Logger | null = null;
  private readonly dbName = 'HermacaDiscordBot';
  private afkCache = new Set<string>();

  constructor() {
    this.botId = process.env.BOT_IDENTIFIER || '';
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI environment variable is required');

    this.client = new MongoClient(uri, {
      tls: true,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
  }

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  private log(tag: string, msg: string, isError = false): void {
    if (!this.logger) return;
    if (isError) {
      this.logger.error(tag, msg);
    } else {
      this.logger.info(tag, msg);
    }
  }

  private logSuccess(tag: string, msg: string): void {
    this.logger?.success(tag, msg);
  }

  private logWarn(tag: string, msg: string): void {
    this.logger?.warn?.(tag, msg);
  }

  private collection<T extends Document>(name: string): Collection<T> {
    if (!this.db) throw new Error('Database not connected');
    if (name === 'lyrics_cache') {
      return this.db.collection<T>(name);
    }
    const prefixed = this.botId ? `${this.botId}_${name}` : name;
    return this.db.collection<T>(prefixed);
  }

  // --------------------------------------------------------------------
  // Connection Management
  // --------------------------------------------------------------------

  /**
   * Lazy connect helper used by every individual DB method. Stays silent —
   * the boot-block init logs are emitted by `initWithLogs` instead so they
   * appear in the right place in the boot block.
   */
  async connect(): Promise<boolean> {
    if (this.connected) return true;
    try {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.connected = true;
      return true;
    } catch (error) {
      this.log('DATABASE', `Connection failed: ${(error as Error).message}`, true);
      return false;
    }
  }

  /**
   * Boot-block initialiser. Emits the four `[DATABASE] 🪐 ...` lines from the
   * startup spec in the correct order. Idempotent — safe to call once per boot.
   */
  async initWithLogs(buildName: string): Promise<void> {
    const usePrefix = !!this.botId;
    const ident = this.botId || 'default';
    this.logger?.info(
      'DATABASE',
      `🪐 Database initialized for bot: ${ident} (Using ${usePrefix ? 'PREFIXED' : 'DEFAULT'} Collection)`,
    );

    if (!this.connected) {
      try {
        await this.client.connect();
        this.db = this.client.db(this.dbName);
        this.connected = true;
      } catch (error) {
        this.log('DATABASE', `Connection failed: ${(error as Error).message}`, true);
        return;
      }
    }
    this.logger?.info('DATABASE', `🪐 Connected to ${this.dbName} for bot: ${buildName}`);

    try {
      await this.collection('lyrics_cache').createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: 2592000 },
      );
      this.logger?.info('DATABASE', `🪐 Lyrics cache TTL index ensured`);
    } catch (error) {
      this.logWarn('DATABASE', `Lyrics index error: ${(error as Error).message}`);
    }

    this.logger?.info('DATABASE', `🪐 Database connected`);
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
    this.log('DATABASE', 'Connection closed');
  }

  // --------------------------------------------------------------------
  // Cluster ID (shared across workers)
  // --------------------------------------------------------------------

  async ping(): Promise<number | null> {
    if (!this.db || !this.connected) return null;
    try {
      const start = Date.now();
      await this.db.command({ ping: 1 });
      return Date.now() - start;
    } catch {
      return null;
    }
  }

  async getOrCreateClusterId(): Promise<number> {
    await this.connect();
    const coll = this.db!.collection<{ botId: string; clusterId: number; createdAt?: Date; updatedAt?: Date }>('bot_cluster_registry');
    const existing = await coll.findOne({ botId: this.botId });
    if (existing) return existing.clusterId;

    const highest = await coll.findOne({}, { sort: { clusterId: -1 } });
    const nextId = (highest?.clusterId ?? 0) + 1;
    await coll.insertOne({
      botId: this.botId,
      clusterId: nextId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.logSuccess('DATABASE', `Assigned new Cluster ID: ${nextId}`);
    return nextId;
  }

  // --------------------------------------------------------------------
  // Guild Volumes
  // --------------------------------------------------------------------

  async getGuildVolume(guildId: string): Promise<number | null> {
    await this.connect();
    const doc = await this.collection<{ guild_id: string; volume: number }>('volumes').findOne({ guild_id: guildId });
    return doc?.volume ?? null;
  }

  async setGuildVolume(guildId: string, volume: number): Promise<boolean> {
    await this.connect();
    await this.collection<{ guild_id: string; volume: number }>('volumes').updateOne(
      { guild_id: guildId },
      { $set: { volume, updatedAt: new Date() } },
      { upsert: true },
    );
    return true;
  }

  async removeGuildVolume(guildId: string): Promise<boolean> {
    await this.connect();
    const result = await this.collection<{ guild_id: string; volume: number }>('volumes').deleteOne({ guild_id: guildId });
    return result.deletedCount > 0;
  }

  // --------------------------------------------------------------------
  // Sticky Messages
  // --------------------------------------------------------------------
  // Schema (collection: `sticky_messages`):
  //   { guild_id, channel_id, type: 'text'|'cv2'|'embed', payload: string,
  //     enabled: boolean, last_message_id: string|null, updated_at: Date }
  // `payload` is the raw text for 'text', or a JSON string for 'cv2'/'embed'.

  async getSticky(guildId: string, channelId: string): Promise<any | null> {
    await this.connect();
    return this.collection('sticky_messages').findOne({ guild_id: guildId, channel_id: channelId });
  }

  async getAllStickies(): Promise<any[]> {
    await this.connect();
    return this.collection('sticky_messages').find().toArray();
  }

  async setSticky(
    guildId: string,
    channelId: string,
    type: 'text' | 'cv2' | 'embed',
    payload: string,
    lastMessageId: string | null,
  ): Promise<boolean> {
    await this.connect();
    await this.collection('sticky_messages').updateOne(
      { guild_id: guildId, channel_id: channelId },
      {
        $set: {
          type,
          payload,
          enabled: true,
          last_message_id: lastMessageId,
          updated_at: new Date(),
        },
      },
      { upsert: true },
    );
    return true;
  }

  async setStickyLastMessageId(
    guildId: string,
    channelId: string,
    lastMessageId: string | null,
  ): Promise<void> {
    await this.connect();
    await this.collection('sticky_messages').updateOne(
      { guild_id: guildId, channel_id: channelId },
      { $set: { last_message_id: lastMessageId, updated_at: new Date() } },
    );
  }

  async setStickyEnabled(guildId: string, channelId: string, enabled: boolean): Promise<boolean> {
    await this.connect();
    const result = await this.collection('sticky_messages').updateOne(
      { guild_id: guildId, channel_id: channelId },
      { $set: { enabled, updated_at: new Date() } },
    );
    return result.matchedCount > 0;
  }

  async loadGuildVolumes(): Promise<Map<string, number>> {
    await this.connect();
    const coll = this.collection<{ guild_id: string; volume: number }>('volumes');
    const docs = await coll.find().toArray();
    return new Map(docs.map((d: { guild_id: string; volume: number }) => [d.guild_id, d.volume]));
  }

  async saveGuildVolumes(volumeMap: Map<string, number>): Promise<boolean> {
    await this.connect();
    const ops = Array.from(volumeMap).map(([guildId, volume]) => ({
      updateOne: {
        filter: { guild_id: guildId },
        update: { $set: { volume, updatedAt: new Date() } },
        upsert: true,
      },
    }));
    if (ops.length) await this.collection('volumes').bulkWrite(ops);
    return true;
  }

  // --------------------------------------------------------------------
  // Guild Prefixes
  // --------------------------------------------------------------------

  async getAllGuildPrefixes(): Promise<Map<string, string>> {
    await this.connect();
    const coll = this.collection<GuildPrefixDoc>('guild_prefixes');
    const docs = await coll.find().toArray();
    return new Map(docs.map((d: GuildPrefixDoc) => [d.guild_id, d.prefix]));
  }

  async getGuildPrefix(guildId: string): Promise<string | null> {
    await this.connect();
    const doc = await this.collection<GuildPrefixDoc>('guild_prefixes').findOne({ guild_id: guildId });
    return doc?.prefix ?? null;
  }

  async setGuildPrefix(guildId: string, prefix: string): Promise<boolean> {
    await this.connect();
    await this.collection<GuildPrefixDoc>('guild_prefixes').updateOne(
      { guild_id: guildId },
      { $set: { prefix, updated_at: new Date() } },
      { upsert: true }
    );
    return true;
  }

  async removeGuildPrefix(guildId: string): Promise<boolean> {
    await this.connect();
    const result = await this.collection<GuildPrefixDoc>('guild_prefixes').deleteOne({ guild_id: guildId });
    return result.deletedCount > 0;
  }

  // --------------------------------------------------------------------
  // 24/7 Mode
  // --------------------------------------------------------------------

  async get24Seven(guildId: string): Promise<{ channelId: string; enabled: boolean } | null> {
    await this.connect();
    const doc = await this.collection<TwentyFourSevenDoc>('twentyfour_seven').findOne({ guild_id: guildId });
    if (!doc) return null;
    return { channelId: doc.channelId, enabled: doc.enabled };
  }

  async set24Seven(guildId: string, channelId: string): Promise<void> {
    await this.connect();
    await this.collection<TwentyFourSevenDoc>('twentyfour_seven').updateOne(
      { guild_id: guildId },
      { $set: { channelId, enabled: true, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async clear24Seven(guildId: string): Promise<void> {
    await this.connect();
    await this.collection<TwentyFourSevenDoc>('twentyfour_seven').updateOne(
      { guild_id: guildId },
      { $set: { enabled: false, updatedAt: new Date() } }
    );
  }

  async getAllEnabled24Seven(): Promise<Array<{ guildId: string; channelId: string }>> {
    await this.connect();
    const docs = await this.collection<TwentyFourSevenDoc>('twentyfour_seven').find({ enabled: true }).toArray();
    return docs.map((d: TwentyFourSevenDoc) => ({ guildId: d.guild_id, channelId: d.channelId }));
  }

  // --------------------------------------------------------------------
  // AFK (Server & Global unified)
  // --------------------------------------------------------------------

  async setAFK(data: {
    userId: string;
    guildId: string | null;
    scope: 'server' | 'global';
    reason: string;
    imageUrl: string | null;
    sinceAt: Date;
    tillAt: Date | null;
  }): Promise<boolean> {
    await this.connect();
    const filter = data.scope === 'server'
      ? { user_id: data.userId, guild_id: data.guildId, scope: 'server' as const }
      : { user_id: data.userId, scope: 'global' as const };
    await this.collection<AFKEntry>('afk_statuses').updateOne(
      filter as any,
      {
        $set: {
          user_id: data.userId,
          guild_id: data.scope === 'server' ? data.guildId : null,
          scope: data.scope,
          reason: data.reason,
          image_url: data.imageUrl,
          since_at: data.sinceAt,
          till_at: data.tillAt,
          updated_at: new Date(),
        },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );
    this.afkCache.add(data.userId);
    return true;
  }

  async removeActiveAFKForMessage(userId: string, guildId: string): Promise<AFKEntry[]> {
    await this.connect();
    const coll = this.collection<AFKEntry>('afk_statuses');
    const filter = {
      user_id: userId,
      $or: [
        { scope: 'global' as const },
        { scope: 'server' as const, guild_id: guildId },
      ],
    };
    const docs = await coll.find(filter as any).toArray();
    if (docs.length) {
      await coll.deleteMany(filter as any);
      const remaining = await coll.countDocuments({ user_id: userId });
      if (remaining === 0) this.afkCache.delete(userId);
    }
    return docs;
  }

  public isUserAFK(userId: string): boolean {
    return this.afkCache.has(userId);
  }

  async initAfkCache(): Promise<void> {
    await this.connect();
    const ids: string[] = await this.collection<AFKEntry>('afk_statuses').distinct('user_id');
    this.afkCache = new Set(ids);
  }

  /** Silent variant for the boot-block load-data section. Returns the count. */
  async populateAfkCacheSilent(): Promise<number> {
    await this.connect();
    const ids: string[] = await this.collection<AFKEntry>('afk_statuses').distinct('user_id');
    this.afkCache = new Set(ids);
    return this.afkCache.size;
  }

  async getAFK(userId: string, guildId?: string): Promise<AFKEntry | null> {
    await this.connect();
    if (guildId) {
      const serverAFK = await this.collection<AFKEntry>('afk_statuses').findOne({
        user_id: userId,
        guild_id: guildId,
        scope: 'server',
      });
      if (serverAFK) return serverAFK;
    }
    const globalAFK = await this.collection<AFKEntry>('afk_statuses').findOne({
      user_id: userId,
      scope: 'global',
    });
    return globalAFK;
  }

  // --------------------------------------------------------------------
  // No-Prefix System
  // --------------------------------------------------------------------

  async getNoprefixGlobalEnabled(): Promise<boolean> {
    await this.connect();
    const coll = this.collection<{ _id?: string; enabled: boolean }>('settings');
    const doc = await coll.findOne({ _id: 'noprefix_global' } as any);
    return doc?.enabled ?? true;
  }

  async setNoprefixGlobalEnabled(enabled: boolean): Promise<boolean> {
    await this.connect();
    await this.collection('settings').updateOne(
      { _id: 'noprefix_global' } as any,
      { $set: { enabled, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  }

  async isNoPrefixUser(userId: string): Promise<boolean> {
    await this.connect();
    return !!(await this.collection<NoPrefixUserDoc>('noprefix_users').findOne({ user_id: userId }));
  }

  async isGuildNoPrefixDisabled(guildId: string): Promise<boolean> {
    await this.connect();
    return !!(await this.collection<NoPrefixDisabledGuildDoc>('noprefix_disabled_guilds').findOne({ guild_id: guildId }));
  }

  async addNoPrefixUser(userId: string, addedBy?: string): Promise<boolean> {
    await this.connect();
    await this.collection<NoPrefixUserDoc>('noprefix_users').updateOne(
      { user_id: userId },
      { $set: { addedAt: new Date(), addedBy } },
      { upsert: true }
    );
    return true;
  }

  async removeNoPrefixUser(userId: string): Promise<boolean> {
    await this.connect();
    const result = await this.collection<NoPrefixUserDoc>('noprefix_users').deleteOne({ user_id: userId });
    return result.deletedCount > 0;
  }

  async getNoPrefixUsers(): Promise<NoPrefixUserDoc[]> {
    await this.connect();
    return await this.collection<NoPrefixUserDoc>('noprefix_users').find().sort({ addedAt: 1 }).toArray();
  }

  async disableGuildNoPrefix(guildId: string, disabledBy?: string): Promise<boolean> {
    await this.connect();
    await this.collection<NoPrefixDisabledGuildDoc>('noprefix_disabled_guilds').updateOne(
      { guild_id: guildId },
      { $set: { disabledAt: new Date(), disabledBy } },
      { upsert: true }
    );
    return true;
  }

  async enableGuildNoPrefix(guildId: string): Promise<boolean> {
    await this.connect();
    const result = await this.collection<NoPrefixDisabledGuildDoc>('noprefix_disabled_guilds').deleteOne({ guild_id: guildId });
    return result.deletedCount > 0;
  }

  async getNoPrefixDisabledGuilds(): Promise<NoPrefixDisabledGuildDoc[]> {
    await this.connect();
    return await this.collection<NoPrefixDisabledGuildDoc>('noprefix_disabled_guilds').find().sort({ disabledAt: 1 }).toArray();
  }

  // --------------------------------------------------------------------
  // Lyrics Cache
  // --------------------------------------------------------------------

  async getLyricsCache(key: string): Promise<{ lyrics: string; source: string } | null> {
    await this.connect();
    return await this.collection<{ key: string; lyrics: string; source: string }>('lyrics_cache').findOne({ key });
  }

  async saveLyricsCache(key: string, data: { lyrics: string; source: string }): Promise<boolean> {
    await this.connect();
    await this.collection('lyrics_cache').updateOne(
      { key },
      { $set: { ...data, timestamp: new Date() } },
      { upsert: true }
    );
    return true;
  }

  async ensureLyricsIndex(): Promise<void> {
    // Now folded into initWithLogs(); kept as a no-op shim for any callers
    // that may still invoke it directly.
    await this.connect();
  }

  // --------------------------------------------------------------------
  // Guild Invite Cache
  // --------------------------------------------------------------------
  // Schema (collection: `guild_invites`):
  //   { guild_id: string, code: string, updated_at: Date }
  // Used for [SERVER LIST] block and the `/invite-guild` admin tool.
  // Codes are validated at boot — invalid ones are recreated, missing ones
  // surface as "N/A" if the bot lacks `CreateInstantInvite` perms.

  async getGuildInvite(guildId: string): Promise<string | null> {
    await this.connect();
    const doc = await this.collection<{ guild_id: string; code: string }>('guild_invites')
      .findOne({ guild_id: guildId });
    return doc?.code ?? null;
  }

  async setGuildInvite(guildId: string, code: string): Promise<void> {
    await this.connect();
    await this.collection('guild_invites').updateOne(
      { guild_id: guildId },
      { $set: { guild_id: guildId, code, updated_at: new Date() } },
      { upsert: true },
    );
  }

  async removeGuildInvite(guildId: string): Promise<void> {
    await this.connect();
    await this.collection('guild_invites').deleteOne({ guild_id: guildId });
  }

  async getAllGuildInvites(): Promise<Map<string, string>> {
    await this.connect();
    const docs = await this.collection<{ guild_id: string; code: string }>('guild_invites')
      .find().toArray();
    return new Map(docs.map(d => [d.guild_id, d.code]));
  }

  // --------------------------------------------------------------------
  // User Stats
  // --------------------------------------------------------------------

  async recordSongPlay(userId: string, track: any): Promise<boolean> {
    await this.connect();
    const coll = this.collection<UserStatsDoc>('user_stats');
    await coll.updateOne(
      { discord_user_id: userId },
      {
        $inc: { totalPlays: 1, totalListeningTime: track.length || 0 },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { songs: [], artists: [], createdAt: new Date() },
      },
      { upsert: true }
    );
    return true;
  }

  async getUserStats(userId: string): Promise<UserStatsDoc | null> {
    await this.connect();
    return await this.collection<UserStatsDoc>('user_stats').findOne({ discord_user_id: userId });
  }

  // --------------------------------------------------------------------
  // Blacklist
  // --------------------------------------------------------------------

  async getBlacklistGlobalEnabled(): Promise<boolean> {
    await this.connect();
    const coll = this.collection<{ _id?: string; enabled: boolean }>('settings');
    const doc = await coll.findOne({ _id: 'blacklist_global' } as any);
    return doc?.enabled ?? true;
  }

  async setBlacklistGlobalEnabled(enabled: boolean): Promise<boolean> {
    await this.connect();
    await this.collection('settings').updateOne(
      { _id: 'blacklist_global' } as any,
      { $set: { enabled, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  }

  async getBlacklistServerGlobalEnabled(): Promise<boolean> {
    await this.connect();
    const coll = this.collection<{ _id?: string; enabled: boolean }>('settings');
    const doc = await coll.findOne({ _id: 'blacklist_server_global' } as any);
    return doc?.enabled ?? true;
  }

  async setBlacklistServerGlobalEnabled(enabled: boolean): Promise<boolean> {
    await this.connect();
    await this.collection('settings').updateOne(
      { _id: 'blacklist_server_global' } as any,
      { $set: { enabled, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  }

  async isBlacklisted(userId: string): Promise<boolean> {
    return this.isUserBlacklisted(userId);
  }

  async isUserBlacklisted(userId: string): Promise<boolean> {
    await this.connect();
    return !!(await this.collection<BlacklistUserDoc>('blacklist_users').findOne({ user_id: userId }));
  }

  async addBlacklistedUser(userId: string, addedBy?: string): Promise<boolean> {
    await this.connect();
    await this.collection<BlacklistUserDoc>('blacklist_users').updateOne(
      { user_id: userId },
      { $set: { addedAt: new Date(), addedBy } },
      { upsert: true }
    );
    return true;
  }

  async removeBlacklistedUser(userId: string): Promise<boolean> {
    await this.connect();
    const result = await this.collection<BlacklistUserDoc>('blacklist_users').deleteOne({ user_id: userId });
    return result.deletedCount > 0;
  }

  async getBlacklistedUsers(): Promise<BlacklistUserDoc[]> {
    await this.connect();
    return await this.collection<BlacklistUserDoc>('blacklist_users').find().sort({ addedAt: 1 }).toArray();
  }

  async isServerBlacklisted(guildId: string): Promise<boolean> {
    await this.connect();
    return !!(await this.collection<BlacklistServerDoc>('blacklist_servers').findOne({ guild_id: guildId }));
  }

  async addBlacklistedServer(guildId: string, addedBy?: string): Promise<boolean> {
    await this.connect();
    await this.collection<BlacklistServerDoc>('blacklist_servers').updateOne(
      { guild_id: guildId },
      { $set: { addedAt: new Date(), addedBy } },
      { upsert: true }
    );
    return true;
  }

  async removeBlacklistedServer(guildId: string): Promise<boolean> {
    await this.connect();
    const result = await this.collection<BlacklistServerDoc>('blacklist_servers').deleteOne({ guild_id: guildId });
    return result.deletedCount > 0;
  }

  async getBlacklistedServers(): Promise<BlacklistServerDoc[]> {
    await this.connect();
    return await this.collection<BlacklistServerDoc>('blacklist_servers').find().sort({ addedAt: 1 }).toArray();
  }

  // --------------------------------------------------------------------
  // Guild Embed Color Customization
  // --------------------------------------------------------------------

  async getGuildEmbedColor(guildId: string): Promise<string | null> {
    await this.connect();
    const doc = await this.collection<{ guild_id: string; embed_color: string }>('guild_settings').findOne({ guild_id: guildId });
    return doc?.embed_color ?? null;
  }

  async setGuildEmbedColor(guildId: string, color: string): Promise<boolean> {
    await this.connect();
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      this.logWarn('DATABASE', `Invalid color format: ${color}`);
      return false;
    }
    await this.collection('guild_settings').updateOne(
      { guild_id: guildId },
      { $set: { embed_color: color, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  }

  async resetGuildEmbedColor(guildId: string): Promise<boolean> {
    await this.connect();
    await this.collection('guild_settings').updateOne(
      { guild_id: guildId },
      { $unset: { embed_color: '' }, $set: { updatedAt: new Date() } }
    );
    return true;
  }

  // --------------------------------------------------------------------
  // Pending Restart Notification
  // --------------------------------------------------------------------

  async setPendingRestartChannel(channelId: string, guildId: string): Promise<void> {
    await this.connect();
    await this.collection('settings').updateOne(
      { _id: 'pending_restart' } as any,
      { $set: { channelId, guildId, createdAt: new Date() } },
      { upsert: true }
    );
  }

  async getPendingRestartChannel(): Promise<{ channelId: string; guildId: string } | null> {
    await this.connect();
    const doc = await this.collection<{ channelId: string; guildId: string }>('settings').findOne({ _id: 'pending_restart' } as any);
    if (!doc) return null;
    return { channelId: doc.channelId, guildId: doc.guildId };
  }

  async clearPendingRestartChannel(): Promise<void> {
    await this.connect();
    await this.collection('settings').deleteOne({ _id: 'pending_restart' } as any);
  }

  // --------------------------------------------------------------------
  // Global Counters (songs played, commands executed — lifetime totals)
  // --------------------------------------------------------------------

  async incrementGlobalSongsPlayed(): Promise<void> {
    if (!this.db || !this.connected) return;
    await this.collection('settings').updateOne(
      { _id: 'global_stats' } as any,
      { $inc: { songsPlayed: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async getGlobalSongsPlayed(): Promise<number> {
    await this.connect();
    const doc = await this.collection<{ songsPlayed?: number }>('settings').findOne({ _id: 'global_stats' } as any);
    return doc?.songsPlayed ?? 0;
  }

  async incrementGlobalCommandsExecuted(): Promise<void> {
    if (!this.db || !this.connected) return;
    await this.collection('settings').updateOne(
      { _id: 'global_stats' } as any,
      { $inc: { commandsExecuted: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
  }

  async getGlobalCommandsExecuted(): Promise<number> {
    await this.connect();
    const doc = await this.collection<{ commandsExecuted?: number }>('settings').findOne({ _id: 'global_stats' } as any);
    return doc?.commandsExecuted ?? 0;
  }
}

export const db = new Database();

/**
 * Boot-block database initialiser. Performs the connect, ensures TTL indexes,
 * and emits the four `[DATABASE] 🪐 ...` lines required by the startup spec.
 * The cached-data load (AFK / volumes / prefixes / stickies) is handled
 * separately by bootstrap so each line goes under the proper
 * `[DATABASE - LOADING DATA]` tag.
 */
export async function initDatabase(logger: Logger, buildName: string): Promise<Database> {
  db.setLogger(logger);
  await db.initWithLogs(buildName);
  return db;
}
