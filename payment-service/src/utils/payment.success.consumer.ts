import { KafkaService, logger } from "../../../utils/src";
import { PaymentRepository } from "../repositories/payment.repository";

interface PaymentSuccessMessage {
  eventId: string;
  paymentId: string;
  bookingId: string;
}

export class PaymentSuccessConsumer {
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY = 1000;
  private readonly kafkaService: KafkaService;
  private readonly paymentRepository: PaymentRepository;
  private readonly DLQ_TOPIC = "payment.success.dlq";

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

  async handle(message: PaymentSuccessMessage) {
    const { eventId, paymentId, bookingId } = message;

    let attempt = 0;

    while (attempt < this.MAX_RETRIES) {
      try {
        logger.info(`Processing payment.success eventId=${eventId} attempt=${attempt + 1}`);

        await this.processBookingSuccess(paymentId, bookingId);

        logger.info(`Processed successfully eventId=${eventId}`);

        return;
      } catch (err: any) {
        attempt++;
        if (attempt >= this.MAX_RETRIES) {
          logger.error(`Max retries reached for event ${eventId}. Sending to DLQ.`);
          await this.sendToDLQ(message, err);
          return;
        }

        const delay = Math.pow(2, attempt) * this.BASE_DELAY;

        logger.warn(`Retrying message eventId=${eventId} attempt=${attempt} delay=${delay}ms`);

        await this.sleep(delay);
      }
    }
  }

  private async processBookingSuccess(paymentId: string, bookingId: string) {
    // Atomically update only if status is NOT already SUCCESS
    // This handles race conditions where two consumers process the same event
    const result = await this.paymentRepository.updateManyPaymentsNotSuccess(paymentId);

    if (result && result.count > 0) {
      logger.info(`Payment ${paymentId} status updated to SUCCESS`);
    }
  }

  private async sendToDLQ(message: PaymentSuccessMessage, err: Error) {
    try {
      logger.error(`Sending to DLQ: eventId=${message.eventId} error=${err.message}`);

      await this.kafkaService.publishMessage({
        topic: this.DLQ_TOPIC,
        message: {
          originalPayload: message,
          error: err.message,
          stack: err.stack,
          failedAt: new Date(),
          retryCount: this.MAX_RETRIES,
        },
      });
    } catch (dlqError: any) {
      // Critical error: Failed to process AND failed to send to DLQ.
      logger.error(
        `CRITICAL: Failed to send to DLQ eventId=${message.eventId} error=${dlqError.message}`,
      );
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
