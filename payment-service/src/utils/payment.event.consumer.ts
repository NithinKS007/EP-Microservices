import { KafkaService, logger } from "../../../utils/src";
import { PaymentRepository } from "../repositories/payment.repository";

interface PaymentEventMessage {
  eventId: string;
  paymentId: string;
  bookingId: string;
}

interface PaymentEventConfig {
  topic: "payment.success" | "payment.failed";
  dlqTopic: "payment.success.dlq" | "payment.failed.dlq";
}

export class PaymentEventConsumer {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000;
  private readonly kafkaService: KafkaService;
  private readonly paymentRepository: PaymentRepository;

  constructor({
    kafkaService,
    paymentRepository,
  }: {
    kafkaService: KafkaService;
    paymentRepository: PaymentRepository;
  }) {
    this.kafkaService = kafkaService;
    this.paymentRepository = paymentRepository;
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
      () => this.processPaymentSuccess(message.paymentId),
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
      () => this.processPaymentFailure(message.paymentId),
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
      } catch (err: any) {
        attempt++;

        if (attempt >= this.MAX_RETRIES) {
          logger.error(`Max retries reached for event ${eventId}. Sending to DLQ.`);
          await this.sendToDLQ(message, err, config.dlqTopic);
          return;
        }
        const delay = Math.pow(2, attempt) * this.BASE_DELAY;
        logger.warn(`Retrying message eventId=${eventId} attempt=${attempt} delay=${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Updates the payment status to SUCCESS idempotently.
   * Used in: Payment success consumer
   * Triggered via: Kafka consumer
   */
  private async processPaymentSuccess(paymentId: string): Promise<void> {
    const result = await this.paymentRepository.updateManyPaymentsNotSuccess(paymentId);

    if (result && result.count > 0) {
      logger.info(`Payment ${paymentId} status updated to SUCCESS`);
    }
  }

  /**
   * Updates the payment status to FAILED idempotently.
   * Used in: Payment failure consumer
   * Triggered via: Kafka consumer
   */
  private async processPaymentFailure(paymentId: string): Promise<void> {
    const result = await this.paymentRepository.updateManyPaymentsNotFailed(paymentId);

    if (result && result.count > 0) {
      logger.info(`Payment ${paymentId} status updated to FAILED`);
    }
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
    } catch (dlqError: any) {
      logger.error(
        `CRITICAL: Failed to send to DLQ eventId=${message.eventId} error=${dlqError.message}`,
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
