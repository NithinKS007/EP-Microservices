import { IOutboxEventRepository } from "../interface/IOutbox.event.repository";
import { KafkaService, logger } from "../../../utils/src";
import { OutboxEvent } from "../entity/outbox.event.entity";

export class OutboxWorker {
  private readonly outboxEventRepository: IOutboxEventRepository;
  private readonly kafkaService: KafkaService;

  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_DELAY_MS = 60000;
  private readonly BATCH_SIZE = 50;
  private readonly POLL_INTERVAL = 500;
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
    logger.info("Saga outbox worker started");

    while (this.isRunning) {
      try {
        await this.processBatch();
      } catch (err) {
        logger.error(`Saga outbox worker fatal error ${err}`);
      }

      await this.sleep(this.POLL_INTERVAL);
    }
  }

  private async processBatch(): Promise<void> {
    const events = await this.outboxEventRepository.fetchBatch(this.BATCH_SIZE);
    if (!events.length) return;

    const successIds: string[] = [];

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
    }
  }

  private async processSingleEvent(event: OutboxEvent) {
    await this.kafkaService.publishMessage({
      topic: event.topic,
      message: event.payload,
    });
  }

  private async handleFailure(event: OutboxEvent, err: any) {
    const retryCount = event.retryCount + 1;

    if (retryCount >= this.MAX_RETRIES) {
      await this.outboxEventRepository.update(
        { id: event.id },
        {
          status: "FAILED",
          processedAt: new Date(),
          error: err.message || "Unknown error",
        },
      );
      return;
    }

    const baseDelay = Math.min(Math.pow(2, retryCount) * this.BASE_DELAY_MS, this.MAX_DELAY_MS);
    const jitter = Math.random() * 500;
    const nextRetryAt = new Date(Date.now() + baseDelay + jitter);

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
      this.isRunning = false;
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
