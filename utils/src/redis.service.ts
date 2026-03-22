import { createClient, RedisClientType } from "redis";
import { logger } from "./logger";

export class RedisService {
  private client: RedisClientType;
  private db: number;

  constructor(config: { host: string; port: number; password?: string; db: number }) {
    this.db = config.db;

    const baseConfig = {
      url: `redis://${config.host}:${config.port}`,
      password: config.password,
      socket: {
        reconnectStrategy: (retries: number) => Math.min(retries * 50, 1000),
      },
    };

    this.client = createClient({
      ...baseConfig,
      database: config.db,
    });

    this.setupListeners();
  }

  /* ------------------- INIT ------------------- */
  private setupListeners() {
    // Fires when there is an error
    this.client.on("error", (err) => {
      logger.error(`❌ Redis DB ${this.db} error: ${err}`);
    });

    // Fires when client starts connecting
    this.client.on("connect", () => {
      logger.info(`🔌 Redis DB ${this.db} connecting...`);
    });

    // Fires when client is ready to use
    this.client.on("ready", () => {
      logger.info(`🟢 Redis DB ${this.db} ready`);
    });

    // Fires when connection ends
    this.client.on("end", () => {
      logger.warn(`🔴 Redis DB ${this.db} disconnected`);
    });

    // Fires on reconnection attempt
    this.client.on("reconnecting", () => {
      logger.info(`🔄 Redis DB ${this.db} reconnecting...`);
    });
  }

  async connect() {
    try {
      await this.client.connect();
      logger.info(`✅ Redis DB ${this.db} connected`);
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db} failed to connect ${err}`);
      throw err;
    }
  }

  async disconnect() {
    try {
      await this.client.quit();
      logger.info(`🔴 Redis DB ${this.db} disconnected successfully`);
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db} failed to disconnect ${err}`);
    }
  }

  /* ------------------- CACHE OPERATIONS ------------------- */

  private ensureConnected() {
    if (!this.client.isOpen) {
      throw new Error(`Redis DB ${this.db} client is not connected`);
    }
  }

  async set(key: string, value: string, ttl?: number) {
    this.ensureConnected();
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
        logger.info(`💾 Redis DB ${this.db}: SET key="${key}" with TTL=${ttl}`);
      } else {
        await this.client.set(key, value);
        logger.info(`💾 Redis DB ${this.db}: SET key="${key}"`);
      }
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db}: Failed to SET key="${key}" ${err}`);
    }
  }

  async get(key: string) {
    this.ensureConnected();
    try {
      const value = await this.client.get(key);
      logger.info(`📥 Redis DB ${this.db}: GET key="${key}"`);
      return value;
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db}: Failed to GET key="${key}" ${err}`);
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttl?: number) {
    await this.set(key, JSON.stringify(value), ttl);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db}: Failed to parse JSON key="${key}" ${err}`);
      return null;
    }
  }

  async del(key: string) {
    this.ensureConnected();
    try {
      const result = await this.client.del(key);
      logger.info(`🗑 Redis DB ${this.db}: DEL key="${key}", deleted=${result}`);
      return result;
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db}: Failed to DEL key="${key}" ${err}`);
      return 0;
    }
  }

  async setIfNotExists(key: string, value: string, ttl: number) {
    this.ensureConnected();
    try {
      const result = await this.client.set(key, value, { NX: true, EX: ttl });
      logger.info(`🔒 Redis DB ${this.db}: SETNX key="${key}", ttl=${ttl}, result=${result}`);
      return result;
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db}: Failed to SETNX key="${key}" ${err}`);
      return null;
    }
  }

  async ttl(key: string) {
    this.ensureConnected();
    try {
      const ttl = await this.client.ttl(key);
      logger.info(`⏱ Redis DB ${this.db}: TTL key="${key}" = ${ttl}`);
      return ttl;
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db}: Failed to get TTL key="${key}" ${err}`);
      return -2;
    }
  }

  async flushCache() {
    this.ensureConnected();
    try {
      await this.client.flushDb();
      logger.info(`🧹 Redis DB ${this.db}: Database flushed`);
    } catch (err) {
      logger.error(`❌ Redis DB ${this.db}: Failed to flush database ${err}`);
    }
  }
}
