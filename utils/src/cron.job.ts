import cron from "node-cron";
import { logger } from "./logger";
import { RedisService } from "./redis.service";

export class CronRunner {
  private readonly redisService: RedisService;
  private readonly serviceName: string;

  constructor({
    redisService,
    serviceName,
  }: {
    redisService: RedisService;
    serviceName: string;
  }) {
    if (!redisService) {
      throw new Error("Redis service is required");
    }

    if (!serviceName) {
      throw new Error("Service name is required");
    }

    this.redisService = redisService;
    this.serviceName = serviceName;
  }

  schedule(name: string, expression: string, task: () => Promise<void>) {
    cron.schedule(expression, async () => {
      try {
        if (this.redisService && this.redisService.isConnected()) {
          const lockKey = `${this.serviceName}:cron:lock:${name.toLowerCase().replace(/\s+/g, "_")}`;
          // Attempt to acquire lock for 55 seconds (standard for minutely jobs)
          const acquired = await this.redisService.setNX(lockKey, "locked", 55);

          if (!acquired) {
            // Silence skip logging to avoid noise every minute on all but one replica
            return;
          }
        }

        logger.info(`⏰ Running job: ${name}`);
        await task();
        logger.info(`✅ Completed job: ${name}`);
      } catch (error) {
        logger.error(`❌ Error in job: ${name} ${error}`);
      }
    });
  }
}
