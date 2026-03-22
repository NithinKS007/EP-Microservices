import { IOutboxEventRepository } from "./../interface/IOutbox.event.repository";
import { KafkaService, logger } from "../../../utils/src";
import { OutboxEvent } from "../entity/outbox.event.entity";

export class OutboxWorker {
  private readonly outboxEventRepository: IOutboxEventRepository;
  private readonly kafkaService: KafkaService;
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 1000; // 1s
  private readonly MAX_DELAY_MS = 60000; // 60s
  private readonly BATCH_SIZE = 50;

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

  async processBatch(): Promise<void> {
    const events = await this.outboxEventRepository.fetchBatch(this.BATCH_SIZE);
    if (!events.length) return;
    const successIds: string[] = [];

    for (const event of events) {
      try {
        const payload = event.payload as {
          eventId: string; // RANDOM ID GENERATED
          paymentId: string; // PAYMENT ENTITY ID
          bookingId: string; // BOOKING ENTITY ID
        };
        const data = {
          paymentId: payload.paymentId,
          bookingId: payload.bookingId,
        };

        logger.info(`Processing outbox event ${data}`);

        await this.kafkaService.publishMessage({
          topic: event.topic,
          message: {
            ...data,
          },
        });

        successIds.push(event.id);
      } catch (err) {
        await this.handleFailure(event, err);
      }
    }

    if (successIds.length > 0) {
      await this.outboxEventRepository.updateMany(successIds, {
        status: "SENT",
        processedAt: new Date(),
      });

      logger.info(`Updated outbox events`);
    }
  }

  private async handleFailure<T>(event: OutboxEvent, err: T) {
    const retryCount = event.retryCount + 1;

    if (retryCount >= this.MAX_RETRIES) {
      logger.error("Outbox event moved to FAILED");

      await this.outboxEventRepository.update(
        { id: event.id },
        {
          status: "FAILED",
          processedAt: new Date(),
        },
      );

      // 🔥 Optional: push to DLQ table
      // await this.deadLetterRepository.create(...)

      return;
    }

    // Exponential backoff with cap
    const delay = Math.min(Math.pow(2, retryCount) * this.BASE_DELAY_MS, this.MAX_DELAY_MS);

    const nextRetryAt = new Date(Date.now() + delay);

    logger.warn(
      `Outbox retry scheduled ${{
        eventId: event.id,
        delay,
        retryCount,
        nextRetryAt,
        error: err,
      }}`,
    );

    await this.outboxEventRepository.update(
      { id: event.id },
      {
        retryCount,
        nextRetryAt,
      },
    );
  }
}
