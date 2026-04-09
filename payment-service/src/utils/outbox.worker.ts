import { IOutboxEventRepository } from "../interface/IOutbox.event.repository";
import { KafkaService, logger } from "../../../utils/src";
import { OutboxEvent } from "../entity/outbox.event.entity";

export class OutboxWorker {
  private readonly outboxEventRepository: IOutboxEventRepository;
  private readonly kafkaService: KafkaService;

  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 1000; // 1s
  private readonly MAX_DELAY_MS = 60000; // 60s
  private readonly BATCH_SIZE = 50;
  private readonly POLL_INTERVAL = 5000;
  private isRunning = false;

  constructor({
    outboxEventRepository,
    kafkaService,
  }: {
    outboxEventRepository: IOutboxEventRepository;
    kafkaService: KafkaService;
  }) {
    this.outboxEventRepository = outboxEventRepository;
    this.kafkaService = kafkaService;
  }

  async start() {
    this.isRunning = true;

    this.setupGracefulShutdown();

    logger.info("🚀 Outbox Worker started");

    while (this.isRunning) {
      try {
        await this.processBatch();
      } catch (err) {
        logger.error(`Outbox worker fatal error ${err}`);
      }

      await this.sleep(this.POLL_INTERVAL);
    }

    logger.info("🛑 Outbox Worker stopped");
  }

  async processBatch(): Promise<void> {
    const events = await this.outboxEventRepository.fetchBatch(this.BATCH_SIZE);

    if (!events.length) return;

    const successIds: string[] = [];

    // Parallel processing with limit
    await Promise.all(
      events.map(async (event) => {
        try {
          await this.processSingleEvent(event);
          successIds.push(event.id);
        } catch (err) {
          await this.handleFailure(event, err);
        }
      }),
    );

    if (successIds.length > 0) {
      await this.outboxEventRepository.updateMany(successIds, {
        status: "SENT",
        processedAt: new Date(),
      });

      logger.info(`Outbox events processed: ${successIds.length}`);
    }
  }

  /* ------------------- SINGLE EVENT ------------------- */

  private async processSingleEvent(event: OutboxEvent) {
    // Use payload directly to support generic events without code changes
    const message = event.payload;

    logger.info(`Outbox event processed: ${event.id}`);

    await this.kafkaService.publishMessage({
      topic: event.topic,
      message,
    });
  }

  private async handleFailure(event: OutboxEvent, err: unknown) {
    const retryCount = event.retryCount + 1;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    if (retryCount >= this.MAX_RETRIES) {
      logger.error(`Outbox event failed after ${retryCount} retries`);

      await this.outboxEventRepository.update(
        { id: event.id },
        {
          status: "FAILED",
          processedAt: new Date(),
          error: errorMessage,
        },
      );

      return;
    }

    // Exponential backoff + jitter
    const baseDelay = Math.min(Math.pow(2, retryCount) * this.BASE_DELAY_MS, this.MAX_DELAY_MS);

    const jitter = Math.random() * 500; // Prevent sync retries

    const nextRetryAt = new Date(Date.now() + baseDelay + jitter);

    logger.warn(`Outbox event failed, retrying in ${baseDelay}ms`);

    await this.outboxEventRepository.update(
      { id: event.id },
      {
        retryCount,
        nextRetryAt,
      },
    );
  }

  private setupGracefulShutdown() {
    const shutdown = () => {
      logger.info("Received shutdown signal");
      this.isRunning = false;
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
