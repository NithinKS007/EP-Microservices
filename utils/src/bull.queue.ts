import Bull, { Queue, Job, QueueOptions } from "bull";
import { logger } from "./logger";

export class BullQueueConfig {
  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword: string;
  private readonly db: number;
  private readonly queues: Map<string, Queue> = new Map();

  constructor({
    redisHost,
    redisPort,
    redisPassword,
    db,
  }: {
    redisHost: string;
    redisPort: number;
    redisPassword: string;
    db: number;
  }) {
    if (!redisHost || !redisPort || !redisPassword) {
      throw new Error("BullQueueConfig requires redis config");
    }
    this.redisHost = redisHost;
    this.redisPort = redisPort;
    this.redisPassword = redisPassword;
    this.db = db;
  }

  configure(name: string, defaultJobOptions?: QueueOptions["defaultJobOptions"]): Queue {
    const queue = new Bull(name, {
      redis: {
        host: this.redisHost,
        port: this.redisPort,
        password: this.redisPassword,
        db: this.db,
      },
      defaultJobOptions,
    });

    this.queues.set(name, queue);
    this.setupListeners(name, queue);

    logger.info(`Bull queue "${name}" configured on Redis DB 0`);

    return queue;
  }

  private setupListeners(queueName: string, queue: Queue) {
    queue.on("completed", (job, result) => {
      logger.info(
        `[${queueName}] Job completed ${JSON.stringify({
          jobId: job.id,
          duration: Date.now() - job.timestamp,
          result,
        })}`,
      );
    });

    queue.on("failed", (job, err) => {
      logger.error(
        `[${queueName}] Job failed ${JSON.stringify({
          jobId: job?.id,
          attemptsMade: job?.attemptsMade,
          error: err.message,
          stack: err.stack,
        })}`,
      );

      if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
        logger.error(
          `[${queueName}] Job permanently failed after ${job.attemptsMade} attempts ${JSON.stringify(
            {
              jobId: job.id,
              data: job.data,
            },
          )}`,
        );
      }
    });
  }

  add<T>(
    queueName: string,
    jobName: string,
    data: T,
    customOptions?: Partial<{
      delay: number;
      removeOnComplete: boolean;
      removeOnFail: boolean;
    }>,
  ) {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return queue.add(jobName, data, {
      ...customOptions,
    });
  }

  process(
    queueName: string,
    jobName: string,
    concurrency: number,
    handler: (job: Job) => Promise<void>,
  ) {
    const queue = this.queues.get(queueName);

    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    queue.process(jobName, concurrency, handler);
  }

  getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }

  async shutdownAll() {
    await Promise.all(Array.from(this.queues.values()).map((q) => q.close()));
  }
}
