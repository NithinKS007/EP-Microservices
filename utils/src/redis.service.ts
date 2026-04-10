import { createClient, RedisClientType } from "redis";
import { logger } from "./logger";

type BloomReserveOptions = {
  expansion?: number;
  nonScaling?: boolean;
};

export class RedisService {
  private client: RedisClientType;
  private db: number;

  constructor(config: { host: string; port: number; password?: string; db: number }) {
    this.db = config.db;

    this.client = createClient({
      url: `redis://${config.host}:${config.port}`,
      password: config.password,
      database: config.db,
      socket: {
        reconnectStrategy: (retries: number) => Math.min(retries * 50, 1000),
      },
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.client.on("error", (err) => {
      logger.error(`❌ Redis DB ${this.db} error: ${err}`);
    });

    this.client.on("connect", () => {
      logger.info(`🔌 Redis DB ${this.db} connecting...`);
    });

    this.client.on("ready", () => {
      logger.info(`🟢 Redis DB ${this.db} ready`);
    });

    this.client.on("end", () => {
      logger.warn(`🔴 Redis DB ${this.db} disconnected`);
    });

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

  private ensureConnected() {
    if (!this.client.isOpen) {
      throw new Error(`Redis DB ${this.db} client is not connected`);
    }
  }

  isConnected(): boolean {
    return this.client.isOpen;
  }

  async set(key: string, value: string, ttl?: number) {
    this.ensureConnected();

    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      logger.error(`SET failed key="${key}" ${err}`);
    }
  }

  async get(key: string) {
    this.ensureConnected();

    try {
      return await this.client.get(key);
    } catch (err) {
      logger.error(`GET failed key="${key}" ${err}`);
      return null;
    }
  }

  async del(key: string) {
    this.ensureConnected();

    try {
      return await this.client.del(key);
    } catch (err) {
      logger.error(`DEL failed key="${key}" ${err}`);
      return 0;
    }
  }

  async flushCache() {
    this.ensureConnected();

    try {
      await this.client.flushDb();
      logger.info(`🧹 Redis DB ${this.db}: Database flushed`);
    } catch (err) {
      logger.error(`Flush failed ${err}`);
    }
  }

  async setBit(key: string, offset: number, value: 0 | 1) {
    this.ensureConnected();

    try {
      await this.client.setBit(key, offset, value);
    } catch (err) {
      logger.error(`SETBIT failed ${err}`);
      throw err;
    }
  }

  async getBit(key: string, offset: number): Promise<number> {
    this.ensureConnected();

    try {
      return await this.client.getBit(key, offset);
    } catch (err) {
      logger.error(`GETBIT failed ${err}`);
      throw err;
    }
  }

  private parseBloomResult(result: unknown): boolean {
    return result === 1 || result === "1" || result === true;
  }

  async bfReserve(
    key: string,
    errorRate: number,
    capacity: number,
    options: BloomReserveOptions = {},
  ): Promise<boolean> {
    this.ensureConnected();

    const command = ["BF.RESERVE", key, errorRate.toString(), capacity.toString()];

    if (options.expansion !== undefined) {
      command.push("EXPANSION", options.expansion.toString());
    }

    if (options.nonScaling) {
      command.push("NONSCALING");
    }

    try {
      await this.client.sendCommand(command);
      return true;
    } catch (err) {
      if (err instanceof Error && /item exists/i.test(err.message)) {
        return false;
      }

      throw err;
    }
  }

  async bfAdd(key: string, item: string): Promise<boolean> {
    this.ensureConnected();

    const result = await this.client.sendCommand(["BF.ADD", key, item]);

    return this.parseBloomResult(result);
  }

  async bfExists(key: string, item: string): Promise<boolean> {
    this.ensureConnected();

    const result = await this.client.sendCommand(["BF.EXISTS", key, item]);

    return this.parseBloomResult(result);
  }
}
