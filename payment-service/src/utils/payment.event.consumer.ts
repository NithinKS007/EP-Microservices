import { KafkaService, logger } from "../../../utils/src";
import { BookingServiceGrpcClient, BookingStatus } from "../grpc/booking.client";
import { EventServiceGrpcClient } from "../grpc/event.client";

interface PaymentEventMessage {
  eventId: string;
  paymentId: string;
  bookingId: string;
}

interface PaymentEventConfig {
  topic: "payment.success" | "payment.failed" | "payment.refunded";
  dlqTopic: "payment.success.dlq" | "payment.failed.dlq" | "payment.refunded.dlq";
}

export class PaymentEventConsumer {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000;
  private readonly kafkaService: KafkaService;
  private readonly bookingServiceGrpcClient: BookingServiceGrpcClient;
  private readonly eventServiceGrpcClient: EventServiceGrpcClient;

  constructor({
    kafkaService,
    bookingServiceGrpcClient,
    eventServiceGrpcClient,
  }: {
    kafkaService: KafkaService;
    bookingServiceGrpcClient: BookingServiceGrpcClient;
    eventServiceGrpcClient: EventServiceGrpcClient;
  }) {
    this.kafkaService = kafkaService;
    this.bookingServiceGrpcClient = bookingServiceGrpcClient;
    this.eventServiceGrpcClient = eventServiceGrpcClient;
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error("Unknown error");
  }

  /**
   * Handles payment success events from Kafka.
   * Used in: Payment webhook success flow
   * Triggered via: Kafka consumer
   */
  async handleSuccess(message: PaymentEventMessage) {
    await this.handleEvent(
      message,
      { topic: "payment.success", dlqTopic: "payment.success.dlq" },
      () => this.processPaymentSuccess(message),
    );
  }

  /**
   * Handles payment failure events from Kafka.
   * Used in: Payment webhook failure flow
   * Triggered via: Kafka consumer
   */
  async handleFailed(message: PaymentEventMessage) {
    await this.handleEvent(
      message,
      { topic: "payment.failed", dlqTopic: "payment.failed.dlq" },
      () => this.processPaymentFailure(message),
    );
  }

  /**
   * Handles payment refunded events from Kafka.
   * Used in: Payment refund settlement flow
   * Triggered via: Kafka consumer
   */
  async handleRefunded(message: PaymentEventMessage) {
    await this.handleEvent(
      message,
      { topic: "payment.refunded", dlqTopic: "payment.refunded.dlq" },
      () => this.processPaymentRefunded(message),
    );
  }

  /**
   * Runs the common retry and DLQ flow for payment status events.
   * Used in: Payment event consumer processing
   * Triggered via: Kafka consumer
   */
  private async handleEvent(
    message: PaymentEventMessage,
    config: PaymentEventConfig,
    action: () => Promise<void>,
  ) {
    const { eventId } = message;
    let attempt = 0;

    while (attempt < this.MAX_RETRIES) {
      try {
        logger.info(`Processing ${config.topic} eventId=${eventId} attempt=${attempt + 1}`);
        await action();
        logger.info(`Processed ${config.topic} successfully eventId=${eventId}`);
        return;
      } catch (err: unknown) {
        attempt++;
        const error = this.normalizeError(err);

        if (attempt >= this.MAX_RETRIES) {
          logger.error(`Max retries reached for event ${eventId}. Sending to DLQ.`);
          await this.sendToDLQ(message, error, config.dlqTopic);
          return;
        }
        const delay = Math.pow(2, attempt) * this.BASE_DELAY;
        logger.warn(`Retrying message eventId=${eventId} attempt=${attempt} delay=${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Finalizes booking and seats after payment success.
   * Used in: Payment success consumer
   * Triggered via: Kafka consumer
   */
  private async processPaymentSuccess(message: PaymentEventMessage): Promise<void> {
    await this.bookingServiceGrpcClient.updateBookingStatus({
      bookingId: message.bookingId,
      status: BookingStatus.BOOKING_STATUS_CONFIRMED,
    });

    await this.eventServiceGrpcClient.confirmSeats({
      bookingId: message.bookingId,
    });
  }

  /**
   * Cancels booking and releases seats after payment failure.
   * Used in: Payment failure consumer
   * Triggered via: Kafka consumer
   */
  private async processPaymentFailure(message: PaymentEventMessage): Promise<void> {
    await this.bookingServiceGrpcClient.updateBookingStatus({
      bookingId: message.bookingId,
      status: BookingStatus.BOOKING_STATUS_CANCELLED,
    });

    await this.eventServiceGrpcClient.releaseSeats({
      bookingId: message.bookingId,
    });
  }

  /**
   * Cancels booking state and releases all seats after a refund is settled.
   * Used in: Payment refund consumer
   * Triggered via: Kafka consumer
   */
  private async processPaymentRefunded(message: PaymentEventMessage): Promise<void> {
    await this.bookingServiceGrpcClient.updateBookingStatus({
      bookingId: message.bookingId,
      status: BookingStatus.BOOKING_STATUS_CANCELLED,
    });

    await this.eventServiceGrpcClient.bulkReleaseSeats({
      bookingIds: [message.bookingId],
    });
  }

  /**
   * Publishes failed payment events to the matching DLQ topic.
   * Used in: Payment consumer failure handling
   * Triggered via: Kafka consumer
   */
  private async sendToDLQ(
    message: PaymentEventMessage,
    err: Error,
    dlqTopic: PaymentEventConfig["dlqTopic"],
  ) {
    try {
      logger.error(`Sending to DLQ: eventId=${message.eventId} error=${err.message}`);

      await this.kafkaService.publishMessage({
        topic: dlqTopic,
        message: {
          originalPayload: message,
          error: err.message,
          stack: err.stack,
          failedAt: new Date(),
          retryCount: this.MAX_RETRIES,
        },
      });
    } catch (dlqError: unknown) {
      const error = this.normalizeError(dlqError);
      logger.error(
        `CRITICAL: Failed to send to DLQ eventId=${message.eventId} error=${error.message}`,
      );
    }
  }

  /**
   * Waits before the next retry attempt.
   * Used in: Payment consumer retry flow
   * Triggered via: Kafka consumer
   */
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
