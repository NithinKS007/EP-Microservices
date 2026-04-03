import { ISagaRepository } from "interface/ISaga.repository";
import { BookingStatus, PaymentStatus } from "../../../utils/src";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { UnitOfWork } from "../repositories/unity.of.work";
import { ISagaStepRepository } from "interface/ISaga.step.repository";
import { BookingServiceGrpcClient } from "../grpc/booking.client";
import { EventServiceGrpcClient } from "../grpc/event.client";
import { PaymentServiceGrpcClient } from "../grpc/payment.client";
import { SagaStatus, StepStatus } from "../generated/prisma/enums";

export class SagaService {
  private readonly sagaRepository: ISagaRepository;
  private readonly sagaStepRepository: ISagaStepRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly bookingServiceGrpcClient: BookingServiceGrpcClient;
  private readonly eventServiceGrpcClient: EventServiceGrpcClient;
  private readonly paymentServiceGrpcClient: PaymentServiceGrpcClient;

  constructor({
    sagaRepository,
    sagaStepRepository,
    unitOfWork,
    bookingServiceGrpcClient,
    eventServiceGrpcClient,
    paymentServiceGrpcClient,
  }: {
    sagaRepository: ISagaRepository;
    sagaStepRepository: ISagaStepRepository;
    unitOfWork: UnitOfWork;
    bookingServiceGrpcClient: BookingServiceGrpcClient;
    eventServiceGrpcClient: EventServiceGrpcClient;
    paymentServiceGrpcClient: PaymentServiceGrpcClient;
  }) {
    this.sagaRepository = sagaRepository;
    this.sagaStepRepository = sagaStepRepository;
    this.unitOfWork = unitOfWork;
    this.bookingServiceGrpcClient = bookingServiceGrpcClient;
    this.eventServiceGrpcClient = eventServiceGrpcClient;
    this.paymentServiceGrpcClient = paymentServiceGrpcClient;
  }

  /**
   * Creates or resumes the cancel-event saga command safely.
   * Used in: Cancel Event Saga start
   * Triggered via: gRPC
   */
  async startCancelEventSaga({ eventId }: { eventId: string }) {
    if (!eventId) {
      throw new ValidationError("Event id is required");
    }

    const existingSaga = await this.sagaRepository.findByTypeAndReferenceId(
      "CANCEL_EVENT",
      eventId,
    );

    if (existingSaga && ["started", "in_progress", "completed"].includes(existingSaga.status)) {
      return {
        sagaId: existingSaga.id,
        status: existingSaga.status,
      };
    }

    if (existingSaga) {
      await this.unitOfWork.withTransaction(async (repos) => {
        await repos.sagaStepRepository.resetRetryableSteps(existingSaga.id);
        await repos.sagaRepository.update(
          { id: existingSaga.id },
          {
            status: "started",
            currentStep: null,
            errorMessage: null,
          },
        );

        await repos.outboxEventRepository.create({
          topic: "saga.cancel.event.requested",
          payload: {
            sagaId: existingSaga.id,
            eventId,
          },
          status: "PENDING",
        });
      });

      return {
        sagaId: existingSaga.id,
        status: "started",
      };
    }

    const createdSaga = await this.unitOfWork.withTransaction(async (repos) => {
      const saga = await repos.sagaRepository.create({
        sagaType: "CANCEL_EVENT",
        referenceId: eventId,
        status: "started",
        currentStep: null,
        steps: {
          create: [
            { stepName: "EVENT_SERVICE", stepOrder: 1, status: "pending" },
            { stepName: "PAYMENT_SERVICE", stepOrder: 2, status: "pending" },
            { stepName: "BOOKING_SERVICE", stepOrder: 3, status: "pending" },
            { stepName: "SEAT_SERVICE", stepOrder: 4, status: "pending" },
          ],
        },
      });

      await repos.outboxEventRepository.create({
        topic: "saga.cancel.event.requested",
        payload: {
          sagaId: saga.id,
          eventId,
        },
        status: "PENDING",
      });

      return saga;
    });

    return {
      sagaId: createdSaga.id,
      status: createdSaga.status,
    };
  }

  /**
   * Runs the payment initiation distributed transaction from the saga boundary.
   * Used in: Booking payment-init flow
   * Triggered via: gRPC
   */
  async startInitiatePaymentSaga({
    bookingId,
    actorId,
    actorRole,
  }: {
    bookingId: string;
    actorId: string;
    actorRole: string;
  }) {
    if (!bookingId || !actorId || !actorRole) {
      throw new ValidationError("Booking id, actor id, and actor role are required");
    }

    const existingSaga = await this.sagaRepository.findByTypeAndReferenceId(
      "INITIATE_PAYMENT",
      bookingId,
    );

    if (existingSaga?.status === SagaStatus.completed) {
      return await this.buildExistingInitiatedPaymentResponse(existingSaga.id, bookingId);
    }

    if (existingSaga?.status === SagaStatus.in_progress || existingSaga?.status === SagaStatus.started) {
      throw new ConflictError("Payment initiation saga is already in progress");
    }

    const saga = existingSaga
      ? await this.restartInitiatePaymentSaga(existingSaga.id)
      : await this.createInitiatePaymentSaga(bookingId);

    return await this.executeInitiatePaymentSaga({
      sagaId: saga.id,
      bookingId,
      actorId,
      actorRole,
    });
  }

  private async createInitiatePaymentSaga(bookingId: string) {
    return await this.unitOfWork.withTransaction(async (repos) => {
      return await repos.sagaRepository.create({
        sagaType: "INITIATE_PAYMENT",
        referenceId: bookingId,
        status: "started",
        currentStep: null,
        steps: {
          create: [
            { stepName: "BOOKING_SERVICE", stepOrder: 1, status: "pending" },
            { stepName: "SEAT_SERVICE", stepOrder: 2, status: "pending" },
            { stepName: "BOOKING_STATUS_SERVICE", stepOrder: 3, status: "pending" },
            { stepName: "PAYMENT_SERVICE", stepOrder: 4, status: "pending" },
          ],
        },
      });
    });
  }

  private async restartInitiatePaymentSaga(sagaId: string) {
    await this.unitOfWork.withTransaction(async (repos) => {
      await repos.sagaStepRepository.resetRetryableSteps(sagaId);
      await repos.sagaRepository.update(
        { id: sagaId },
        {
          status: "started",
          currentStep: null,
          errorMessage: null,
        },
      );
    });

    const saga = await this.sagaRepository.findById(sagaId);
    if (!saga) {
      throw new NotFoundError("Saga not found, Please try again later");
    }
    return saga;
  }

  private async executeInitiatePaymentSaga({
    sagaId,
    bookingId,
    actorId,
    actorRole,
  }: {
    sagaId: string;
    bookingId: string;
    actorId: string;
    actorRole: string;
  }) {
    const steps = await this.sagaStepRepository.findBySagaId(sagaId);
    const stepMap = Object.fromEntries(steps.map((step) => [step.stepName, step]));

    const bookingStep = stepMap["BOOKING_SERVICE"];
    const seatStep = stepMap["SEAT_SERVICE"];
    const bookingStatusStep = stepMap["BOOKING_STATUS_SERVICE"];
    const paymentStep = stepMap["PAYMENT_SERVICE"];

    let booking:
      | {
          id: string;
          userId: string;
          eventId: string;
          totalAmount: number;
          seatIds: string[];
          expiresAt?: Date;
        }
      | undefined;
    let existingInitiatedPayment:
      | {
          id: string;
          providerRef: string;
          amount: number;
          currency: string;
        }
      | undefined;
    let bookingMarkedInitiated = false;
    let seatsLocked = false;

    try {
      await this.sagaRepository.update(
        { id: sagaId },
        { status: "in_progress", currentStep: "BOOKING_SERVICE", errorMessage: null },
      );

      await this.executeStep({
        sagaId,
        step: bookingStep,
        action: async () => {
          const bookingResponse = await this.bookingServiceGrpcClient.findBooking({ bookingId });
          const existingBooking = bookingResponse.booking;

          if (!existingBooking) {
            throw new NotFoundError("Booking not found, Please try again later");
          }

          if (actorRole !== "ADMIN" && existingBooking.userId !== actorId) {
            throw new ForbiddenError("You are not allowed to initiate this payment");
          }

          if (existingBooking.status === BookingStatus.BOOKING_STATUS_CONFIRMED) {
            throw new ConflictError("Booking is already confirmed");
          }

          if (
            existingBooking.status === BookingStatus.BOOKING_STATUS_CANCELLED ||
            existingBooking.status === BookingStatus.BOOKING_STATUS_EXPIRED
          ) {
            throw new ConflictError("Terminal bookings cannot start a new payment");
          }

          if (!existingBooking.seatIds?.length) {
            throw new ConflictError("Booking does not contain any seats to lock");
          }

          if (existingBooking.expiresAt && existingBooking.expiresAt <= new Date()) {
            throw new ConflictError("Booking has already expired");
          }

          const payments = await this.paymentServiceGrpcClient.findPaymentsByBookingIds({
            bookingIds: [bookingId],
          });
          const existingPayment = payments.payments?.[0];

          if (existingPayment) {
            if (
              existingPayment.status === PaymentStatus.PAYMENT_STATUS_INITIATED &&
              existingPayment.providerRef
            ) {
              existingInitiatedPayment = {
                id: existingPayment.id,
                providerRef: existingPayment.providerRef,
                amount: existingPayment.amount,
                currency: existingPayment.currency,
              };
              return;
            }

            if (existingPayment.status === PaymentStatus.PAYMENT_STATUS_SUCCESS) {
              throw new ConflictError("Payment already completed for this booking");
            }

            throw new ConflictError("Payment cannot be re-initiated for this booking");
          }

          booking = {
            id: existingBooking.id,
            userId: existingBooking.userId,
            eventId: existingBooking.eventId,
            totalAmount: existingBooking.totalAmount,
            seatIds: existingBooking.seatIds,
            expiresAt: existingBooking.expiresAt,
          };
        },
      });

      if (existingInitiatedPayment) {
        await this.markStepSkipped({ sagaId, step: seatStep });
        await this.markStepSkipped({ sagaId, step: bookingStatusStep });
        await this.markStepSkipped({ sagaId, step: paymentStep });
        await this.sagaRepository.update(
          { id: sagaId },
          { status: "completed", currentStep: "BOOKING_SERVICE", errorMessage: null },
        );

        return {
          sagaId,
          status: "completed",
          paymentId: existingInitiatedPayment.id,
          razorpayOrderId: existingInitiatedPayment.providerRef,
          amount: existingInitiatedPayment.amount,
          currency: existingInitiatedPayment.currency,
        };
      }

      if (!booking) {
        throw new ValidationError("Booking context is missing");
      }

      await this.executeStep({
        sagaId,
        step: seatStep,
        action: async () => {
          await this.eventServiceGrpcClient.lockSeats({
            bookingId,
            eventId: booking!.eventId,
            seatIds: booking!.seatIds,
            expiresAt: booking!.expiresAt,
          });
          seatsLocked = true;
        },
      });

      await this.executeStep({
        sagaId,
        step: bookingStatusStep,
        action: async () => {
          await this.bookingServiceGrpcClient.updateBookingStatus({
            bookingId,
            status: BookingStatus.BOOKING_STATUS_INITIATED,
          });
          bookingMarkedInitiated = true;
        },
      });

      const paymentResult = await this.executeStepWithResult({
        sagaId,
        step: paymentStep,
        action: async () => {
          const createdPayment = await this.paymentServiceGrpcClient.createPayment({
            amount: booking!.totalAmount,
            bookingId,
            currency: "INR",
            provider: "RAZORPAY",
            userId: booking!.userId,
          });

          return {
            paymentId: createdPayment.paymentId,
            razorpayOrderId: createdPayment.razorpayOrderId,
            amount: createdPayment.amount,
            currency: createdPayment.currency,
          };
        },
      });

      await this.sagaRepository.update(
        { id: sagaId },
        { status: "completed", currentStep: "PAYMENT_SERVICE", errorMessage: null },
      );

      return {
        sagaId,
        status: "completed",
        ...paymentResult,
      };
    } catch (error: any) {
      await this.sagaRepository.update(
        { id: sagaId },
        {
          status: "compensating",
          currentStep: "PAYMENT_SERVICE",
          errorMessage: error.message || "Unknown error",
        },
      );

      await this.compensateInitiatePaymentSaga({
        sagaId,
        bookingId,
        bookingStatusStep,
        seatStep,
        bookingMarkedInitiated,
        seatsLocked,
      });

      throw error;
    }
  }

  private async compensateInitiatePaymentSaga({
    sagaId,
    bookingId,
    bookingStatusStep,
    seatStep,
    bookingMarkedInitiated,
    seatsLocked,
  }: {
    sagaId: string;
    bookingId: string;
    bookingStatusStep: { id: string; stepName: string; status: string } | undefined;
    seatStep: { id: string; stepName: string; status: string } | undefined;
    bookingMarkedInitiated: boolean;
    seatsLocked: boolean;
  }) {
    try {
      if (bookingMarkedInitiated && bookingStatusStep) {
        await this.sagaStepRepository.update(
          { id: bookingStatusStep.id },
          { status: "compensating", errorMessage: null },
        );
        await this.bookingServiceGrpcClient.updateBookingStatus({
          bookingId,
          status: BookingStatus.BOOKING_STATUS_PENDING,
        });
        await this.sagaStepRepository.update(
          { id: bookingStatusStep.id },
          { status: "compensated", completedAt: new Date(), errorMessage: null },
        );
      }

      if (seatsLocked && seatStep) {
        await this.sagaStepRepository.update(
          { id: seatStep.id },
          { status: "compensating", errorMessage: null },
        );
        await this.eventServiceGrpcClient.bulkReleaseSeats({ bookingIds: [bookingId] });
        await this.sagaStepRepository.update(
          { id: seatStep.id },
          { status: "compensated", completedAt: new Date(), errorMessage: null },
        );
      }

      await this.sagaRepository.update(
        { id: sagaId },
        { status: "compensated", currentStep: "SEAT_SERVICE", errorMessage: null },
      );
    } catch (compensationError: any) {
      await this.sagaRepository.update(
        { id: sagaId },
        {
          status: "failed",
          currentStep: "SEAT_SERVICE",
          errorMessage: compensationError.message || "Compensation failed",
        },
      );
      throw compensationError;
    }
  }

  private async executeStep({
    sagaId,
    step,
    action,
  }: {
    sagaId: string;
    step: { id: string; stepName: string; status: string } | undefined;
    action: () => Promise<void>;
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
      { status: "in_progress", startedAt: new Date(), errorMessage: null },
    );

    try {
      await action();
      await this.sagaStepRepository.update(
        { id: step.id },
        { status: "completed", completedAt: new Date(), errorMessage: null },
      );
    } catch (error: any) {
      await this.sagaStepRepository.update(
        { id: step.id },
        { status: "failed", errorMessage: error.message || "Unknown error" },
      );
      throw error;
    }
  }

  private async executeStepWithResult<TResult>({
    sagaId,
    step,
    action,
  }: {
    sagaId: string;
    step: { id: string; stepName: string; status: string } | undefined;
    action: () => Promise<TResult>;
  }): Promise<TResult> {
    if (!step) {
      throw new ValidationError("Saga step is missing, Please try again later");
    }

    if (step.status === StepStatus.completed || step.status === StepStatus.skipped) {
      throw new ConflictError("Saga step is already complete");
    }

    await this.sagaRepository.update({ id: sagaId }, { currentStep: step.stepName });
    await this.sagaStepRepository.update(
      { id: step.id },
      { status: "in_progress", startedAt: new Date(), errorMessage: null },
    );

    try {
      const result = await action();
      await this.sagaStepRepository.update(
        { id: step.id },
        { status: "completed", completedAt: new Date(), errorMessage: null },
      );
      return result;
    } catch (error: any) {
      await this.sagaStepRepository.update(
        { id: step.id },
        { status: "failed", errorMessage: error.message || "Unknown error" },
      );
      throw error;
    }
  }

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
      { status: "skipped", completedAt: new Date(), errorMessage: null },
    );
  }

  private async buildExistingInitiatedPaymentResponse(sagaId: string, bookingId: string) {
    const payments = await this.paymentServiceGrpcClient.findPaymentsByBookingIds({
      bookingIds: [bookingId],
    });
    const payment = payments.payments?.[0];

    if (!payment || !payment.providerRef) {
      throw new ConflictError("Completed payment-init saga does not have an initiated payment");
    }

    return {
      sagaId,
      status: "completed",
      paymentId: payment.id,
      razorpayOrderId: payment.providerRef,
      amount: payment.amount,
      currency: payment.currency,
    };
  }
}
