import { KafkaService, logger } from "../../../utils/src";
import { SagaService } from "../services/saga.service";
import { ISagaRepository } from "interface/ISaga.repository";
import { NotFoundError, ValidationError } from "../../../utils/src/error.handling.middleware";
import { ISagaStepRepository } from "interface/ISaga.step.repository";
import { BookingServiceGrpcClient } from "../grpc/booking.client";
import { PaymentServiceGrpcClient } from "../grpc/payment.client";
import { EventServiceGrpcClient } from "../grpc/event.client";
import { UnitOfWork } from "../repositories/unity.of.work";
import { SagaStatus, StepStatus } from "../generated/prisma/enums";

interface CancelEventSagaMessage {
  sagaId: string;
  eventId: string;
}

export class CancelEventSagaConsumer {
  private readonly DLQ_TOPIC = "saga.cancel.event.dlq";
  private readonly kafkaService: KafkaService;
  private readonly sagaStepRepository: ISagaStepRepository;
  private readonly sagaRepository: ISagaRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly bookingServiceGrpcClient: BookingServiceGrpcClient;
  private readonly paymentServiceGrpcClient: PaymentServiceGrpcClient;
  private readonly eventServiceGrpcClient: EventServiceGrpcClient;
  private readonly STEP_RETRY_LIMIT = 3;
  private readonly BASE_RETRY_DELAY_MS = 1000;

  constructor({
    kafkaService,
    sagaStepRepository,
    sagaRepository,
    unitOfWork,
    bookingServiceGrpcClient,
    paymentServiceGrpcClient,
    eventServiceGrpcClient,
  }: {
    kafkaService: KafkaService;
    sagaStepRepository: ISagaStepRepository;
    sagaRepository: ISagaRepository;
    unitOfWork: UnitOfWork;
    bookingServiceGrpcClient: BookingServiceGrpcClient;
    paymentServiceGrpcClient: PaymentServiceGrpcClient;
    eventServiceGrpcClient: EventServiceGrpcClient;
  }) {
    this.kafkaService = kafkaService;
    this.sagaStepRepository = sagaStepRepository;
    this.sagaRepository = sagaRepository;
    this.unitOfWork = unitOfWork;
    this.bookingServiceGrpcClient = bookingServiceGrpcClient;
    this.paymentServiceGrpcClient = paymentServiceGrpcClient;
    this.eventServiceGrpcClient = eventServiceGrpcClient;
  }

  /**
   * Processes the cancel-event saga command once and relies on step retries inside the saga.
   * Used in: Cancel Event Saga command consumption
   * Triggered via: Saga step
   */
  async handle(message: CancelEventSagaMessage) {
    const { sagaId, eventId } = message;

    try {
      /**
       * Executes the cancel-event saga steps in retry-safe order.
       * Used in: Cancel Event Saga execution
       * Triggered via: Saga step
       */

      const saga = await this.sagaRepository.findById(sagaId);
      if (!saga) {
        throw new NotFoundError("Saga not found, Please try again later");
      }

      if (saga.status === SagaStatus.completed) {
        return;
      }

      await this.sagaRepository.update(
        { id: sagaId },
        {
          status: "in_progress",
          errorMessage: null,
        },
      );

      const steps = await this.sagaStepRepository.findBySagaId(sagaId);
      const stepMap = Object.fromEntries(steps.map((s) => [s.stepName, s]));

      const eventStep = stepMap["EVENT_SERVICE"];
      const paymentStep = stepMap["PAYMENT_SERVICE"];
      const bookingStep = stepMap["BOOKING_SERVICE"];
      const seatStep = stepMap["SEAT_SERVICE"];

      await this.executeStepWithRetry({
        sagaId,
        step: eventStep,
        action: async () => {
          await this.eventServiceGrpcClient.markEventCancelled({ eventId });
        },
      });

      const bookingsResponse = await this.bookingServiceGrpcClient.findBookingsByEvent({ eventId });
      const bookingIds = bookingsResponse.bookings.map((booking) => booking.id);

      if (bookingIds.length === 0) {
        await this.markStepSkipped({ sagaId, step: paymentStep });
        await this.markStepSkipped({ sagaId, step: bookingStep });
        await this.markStepSkipped({ sagaId, step: seatStep });
      } else {
        await this.executeStepWithRetry({
          sagaId,
          step: paymentStep,
          action: async () => {
            await this.paymentServiceGrpcClient.bulkRefundPayments({ bookingIds });
          },
        });

        await this.executeStepWithRetry({
          sagaId,
          step: bookingStep,
          action: async () => {
            await this.bookingServiceGrpcClient.bulkCancelBookings({ bookingIds });
          },
        });

        await this.executeStepWithRetry({
          sagaId,
          step: seatStep,
          action: async () => {
            await this.eventServiceGrpcClient.bulkReleaseSeats({ bookingIds });
          },
        });
      }

      await this.unitOfWork.withTransaction(async (repos) => {
        await repos.sagaRepository.update(
          { id: sagaId },
          {
            status: "completed",
            currentStep: "EVENT_SERVICE",
            errorMessage: null,
          },
        );

        await repos.outboxEventRepository.create({
          topic: "saga.cancel.event.completed",
          payload: {
            sagaId,
            eventId,
          },
          status: "PENDING",
        });
      });
    } catch (err: any) {
      logger.error(`Cancel event saga failed permanently sagaId=${sagaId}`);
      await this.sendToDLQ(message, err);
      return;
    }
  }

  /**
   * Runs one saga step with bounded retries and persisted state updates.
   * Used in: Cancel Event Saga step execution
   * Triggered via: Saga step
   */
  private async executeStepWithRetry({
    sagaId,
    step,
    action,
  }: {
    sagaId: string;
    step: { id: string; stepName: string; status: string; retryCount: number } | undefined;
    action: () => Promise<void>;
  }) {
    if (!step) {
      throw new ValidationError("Saga step is missing, Please try again later");
    }

    if (step.status === StepStatus.completed || step.status === StepStatus.skipped) {
      return;
    }

    let attempt = step.retryCount;

    while (attempt < this.STEP_RETRY_LIMIT) {
      try {
        await this.sagaRepository.update({ id: sagaId }, { currentStep: step.stepName });
        await this.sagaStepRepository.update(
          { id: step.id },
          {
            status: "in_progress",
            startedAt: new Date(),
            errorMessage: null,
          },
        );

        await action();

        await this.sagaStepRepository.update(
          { id: step.id },
          {
            status: "completed",
            completedAt: new Date(),
            errorMessage: null,
          },
        );
        return;
      } catch (err: any) {
        attempt++;

        await this.sagaStepRepository.update(
          { id: step.id },
          {
            status: "failed",
            retryCount: attempt,
            errorMessage: err.message || "Unknown error",
          },
        );

        if (attempt >= this.STEP_RETRY_LIMIT) {
          await this.unitOfWork.withTransaction(async (repos) => {
            await repos.sagaRepository.update(
              { id: sagaId },
              {
                status: "failed",
                currentStep: step.stepName,
                errorMessage: err.message || "Unknown error",
              },
            );

            await repos.outboxEventRepository.create({
              topic: "saga.cancel.event.failed",
              payload: {
                sagaId,
                stepName: step.stepName,
                error: err.message || "Unknown error",
              },
              status: "PENDING",
            });
          });

          logger.error(`Saga step failed permanently sagaId=${sagaId} step=${step.stepName}`);
          throw err;
        }

        const delay = Math.pow(2, attempt) * this.BASE_RETRY_DELAY_MS;
        await this.sleep(delay);
      }
    }
  }

  /**
   * Marks a non-executable saga step as skipped.
   * Used in: Cancel Event Saga execution when no bookings exist
   * Triggered via: Saga step
   */
  private async markStepSkipped({
    sagaId,
    step,
  }: {
    sagaId: string;
    step: { id: string; stepName: string; status: string } | undefined;
  }) {
    if (!step) {
      throw new ValidationError("Saga step is missing, Please try again later");
    }

    if (step.status === StepStatus.completed || step.status === StepStatus.skipped) {
      return;
    }

    await this.sagaRepository.update({ id: sagaId }, { currentStep: step.stepName });
    await this.sagaStepRepository.update(
      { id: step.id },
      {
        status: "skipped",
        completedAt: new Date(),
        errorMessage: null,
      },
    );
  }

  /**
   * Publishes a failed cancel-event command to the DLQ.
   * Used in: Cancel Event Saga command failure handling
   * Triggered via: Saga step
   */
  private async sendToDLQ(message: CancelEventSagaMessage, err: Error) {
    try {
      await this.kafkaService.publishMessage({
        topic: this.DLQ_TOPIC,
        message: {
          originalPayload: message,
          error: err.message,
          stack: err.stack,
          failedAt: new Date(),
          retryCount: 1,
        },
      });
    } catch (dlqError: any) {
      logger.error(`Failed to send cancel event saga to DLQ ${dlqError.message}`);
    }
  }

  /**
   * Sleeps between retry attempts.
   * Used in: Cancel Event Saga step execution
   * Triggered via: Saga step
   */
  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
