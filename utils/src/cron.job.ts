import cron from "node-cron";
import { logger } from "./logger";

export class CronRunner {
  schedule(name: string, expression: string, task: () => Promise<void>) {
    cron.schedule(expression, async () => {
      try {
        logger.info(`⏰ Running job: ${name}`);
        await task();
        logger.info(`✅ Completed job: ${name}`);
      } catch (error) {
        logger.error(`❌ Error in job: ${name} ${error}`);
      }
    });
  }
}
