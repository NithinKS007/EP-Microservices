import cron from "node-cron";

export class CronRunner {
  schedule(name: string, expression: string, task: () => Promise<void>) {
    cron.schedule(expression, async () => {
      try {
        console.log(`⏰ Running job: ${name}`);
        await task();
        console.log(`✅ Completed job: ${name}`);
      } catch (error) {
        console.error(`❌ Error in job: ${name}`, error);
      }
    });
  }
}
