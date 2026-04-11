import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { IPaymentRepository } from "../interface/IPayment.repository";
import { IPaymentEventRepository } from "../interface/IPayment.event.repository";
import {
  AuthReq,
  codeGenerator,
  createCircuitBreaker,
  EmailService,
  logger,
} from "../../../utils/src/index";
import { CreatePaymentDto, WEBHOOK_EVENT_TYPE } from "../dtos/payment.dtos";
import { envConfig } from "../config/env.config";
import Razorpay from "razorpay";
import { Orders } from "razorpay/dist/types/orders";
import { Refunds } from "razorpay/dist/types/refunds";
import { UnitOfWork } from "../repositories/unity.of.work";
import { UserServiceGrpcClient } from "./../grpc/user.client";
import { PaymentStatus } from "../generated/prisma/client";

export class PaymentService {
  private readonly paymentRepository: IPaymentRepository;
  private readonly paymentEventRepository: IPaymentEventRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly userServiceGrpcClient: UserServiceGrpcClient;
  private readonly emailService: EmailService;
  private readonly razorpay = new Razorpay({
    key_id: envConfig.RAZORPAY_KEY_ID,
    key_secret: envConfig.RAZORPAY_KEY_SECRET,
  });
  private readonly createRazorpayOrderBreaker = createCircuitBreaker<
    [number],
    Orders.RazorpayOrder
  >({
    name: "payment.razorpay.create_order",
    timeoutMs: 7000,
    resetTimeoutMs: 20000,
    volumeThreshold: 3,
    action: (amount) => this.executeCreateRazorpayOrder(amount),
  });

  private readonly refundRazorpayPaymentBreaker = createCircuitBreaker<
    [string, number],
    Refunds.RazorpayRefund
  >({
    name: "payment.razorpay.refund",
    timeoutMs: 7000,
    resetTimeoutMs: 20000,
    volumeThreshold: 3,
    action: (paymentId, amount) => this.executeRefundRazorpayPayment(paymentId, amount),
  });

  constructor({
    paymentRepository,
    paymentEventRepository,
    unitOfWork,
    userServiceGrpcClient,
    emailService,
  }: {
    paymentRepository: IPaymentRepository;
    paymentEventRepository: IPaymentEventRepository;
    unitOfWork: UnitOfWork;
    userServiceGrpcClient: UserServiceGrpcClient;
    emailService: EmailService;
  }) {
    this.paymentRepository = paymentRepository;
    this.paymentEventRepository = paymentEventRepository;
    this.unitOfWork = unitOfWork;
    this.userServiceGrpcClient = userServiceGrpcClient;
    this.emailService = emailService;
  }

  /**
   * Creates a payment initiation record and provider order.
   * Used in: Booking payment-init flow
   * Triggered via: REST / gRPC
   */
  async create({ amount, bookingId, currency, provider, userId }: CreatePaymentDto) {
    if (provider !== "RAZORPAY") {
      throw new ValidationError("Unsupported provider,Please try again later");
    }
    const razorpayOrder = await this.createRazorpayOrder(amount);

    logger.info(`Razorpay order created ${JSON.stringify(razorpayOrder)}`);

    const payment = await this.paymentRepository.create({
      amount,
      bookingId,
      currency,
      provider,
      status: "INITIATED",
      userId,
      providerRef: razorpayOrder.id,
    });

    return {
      paymentId: payment.id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    };
  }

  /**
   * Handles successful payment webhooks and publishes the success outbox event.
   * Used in: Payment webhook success flow
   * Triggered via: REST
   */
  async handlePaymentCaptured(payload: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    order_id: string;
    method: string;
  }) {
    const existing = await this.paymentRepository.findByOrderId(payload.order_id);

    if (!existing) {
      logger.warn(`Payment orphaned ORDER_ID ${payload.order_id} PAYLOAD`);

      await this.paymentEventRepository.create({
        paymentId: null,
        type: WEBHOOK_EVENT_TYPE.PAYMENT_ORPHANED,
        payload,
      });
      return;
    }

    if (existing.status === "SUCCESS" || existing.status === "REFUNDED") {
      logger.warn(
        `Payment already captured ORDER_ID ${payload.order_id} PAYLOAD PAYMENT_ID ${existing.id}`,
      );
      return;
    }

    // Special case: Late success received for a payment that was already marked as FAILED.
    // This happens if the user clicks Failure then Success in the same Razorpay modal.
    // Since the booking was already cancelled upon the first failure, we must refund.
    if (existing.status === "FAILED") {
      logger.warn(
        `Late success received for FAILED payment ${existing.id}. Initiated automatic refund.`,
      );

      // 1. Mark as SUCCESS first to record that we actually received the money
      await this.paymentRepository.update({ id: existing.id }, { status: "SUCCESS" });

      // 2. Trigger the refund flow (bypass actor check since it's internal)
      return await this.refundPayment(existing.id, undefined, true);
    }

    await this.unitOfWork.withTransaction(async (repos) => {
      await repos.paymentRepository.update({ id: existing.id }, { status: "SUCCESS" });

      await repos.paymentEventRepository.create({
        paymentId: existing.id,
        type: WEBHOOK_EVENT_TYPE.PAYMENT_CAPTURED,
        payload,
      });

      await repos.outboxEventRepository.create({
        topic: "payment.success",
        payload: {
          eventId: codeGenerator().code,
          paymentId: existing.id,
          bookingId: existing.bookingId,
        },
        status: "PENDING",
      });
    });

    logger.info(
      `Payment captured flow completed successfully ${existing.id}} & added to outbox to topic payment.success`,
    );

    return {
      bookingId: existing.bookingId,
    };
  }

  /**
   * Handles failed payment webhooks and publishes the failure outbox event.
   * Used in: Payment webhook failure flow
   * Triggered via: REST
   */
  async handlePaymentFailed(payload: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    order_id: string;
    method: string;
  }) {
    const existing = await this.paymentRepository.findByOrderId(payload.order_id);
    if (!existing) {
      logger.warn(`Payment not found ORDER_ID ${payload.order_id} PAYLOAD`);
      return;
    }

    if (
      existing.status === "SUCCESS" ||
      existing.status === "FAILED" ||
      existing.status === "REFUNDED"
    ) {
      logger.warn(
        `Payment already terminal ORDER_ID ${payload.order_id} PAYLOAD PAYMENT_ID ${existing.id}`,
      );
      return;
    }

    await this.unitOfWork.withTransaction(async (repos) => {
      await repos.paymentRepository.update({ id: existing.id }, { status: "FAILED" });

      await repos.paymentEventRepository.create({
        paymentId: existing.id,
        type: WEBHOOK_EVENT_TYPE.PAYMENT_FAILED,
        payload: payload,
      });

      await repos.outboxEventRepository.create({
        topic: "payment.failed",
        payload: {
          eventId: codeGenerator().code,
          paymentId: existing.id,
          bookingId: existing.bookingId,
        },
        status: "PENDING",
      });
    });

    logger.info(
      `Payment failed flow completed successfully ${existing.id}} & added to outbox to topic payment.failed`,
    );

    return {
      bookingId: existing.bookingId,
    };
  }

  /**
   * Finds payments for a set of booking ids.
   * Used in: Cancel Event Saga lookup
   * Triggered via: gRPC
   */
  async findPaymentsByBookingIds(bookingIds: string[]) {
    if (!bookingIds.length) {
      return [];
    }

    const payments = await this.paymentRepository.findPaymentsByBookingIds(bookingIds);
    return payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
    }));
  }

  /**
   * Updates one payment status with transition validation.
   * Used in: Internal payment reconciliation flow
   * Triggered via: gRPC
   */
  async updatePaymentStatus(paymentId: string, status: PaymentStatus) {
    if (!paymentId || !status) {
      throw new ValidationError("Missing required fields");
    }

    const existing = await this.paymentRepository.findById(paymentId);
    if (!existing) {
      throw new ValidationError("Payment not found, Please try again later");
    }

    if (status === "REFUNDED" && existing.status !== "SUCCESS") {
      throw new ValidationError("Only successful payments can be refunded");
    }

    if (status === "FAILED" && existing.status === "SUCCESS") {
      throw new ValidationError("Successful payments must be refunded instead of failed");
    }

    if (existing.status === status) {
      return {
        ...existing,
        amount: Number(existing.amount),
      };
    }

    const payment = await this.paymentRepository.update({ id: paymentId }, { status });
    if (!payment) {
      throw new ValidationError("Failed to update payment status, Please try again later");
    }

    return {
      ...payment,
      amount: Number(payment.amount),
    };
  }

  /**
   * Reconciles payments in bulk for a cancelled event.
   * Used in: Cancel Event Saga (Step: Payment Service)
   * Triggered via: gRPC
   */
  async bulkRefundPayments(bookingIds: string[]) {
    if (!bookingIds.length) {
      return {
        refundedCount: 0,
        failedCount: 0,
        skippedCount: 0,
      };
    }

    const existingPayments = await this.paymentRepository.findPaymentsByBookingIds(bookingIds);

    // Use Promise.all to handle refunds in parallel and keep variables 'const'
    const results = await Promise.all(
      existingPayments.map(async (payment) => {
        try {
          if (payment.status === "SUCCESS" && payment.providerRef) {
            // 1. Trigger real refund via Razorpay API
            await this.refundRazorpayPaymentBreaker.fire(
              payment.providerRef,
              Number(payment.amount),
            );

            // 2. Update DB status
            await this.paymentRepository.update({ id: payment.id }, { status: "REFUNDED" });

            // 3. Send email asynchronously (don't await)
            this.sendRefundEmail({
              userId: payment.userId,
              bookingId: payment.bookingId,
              currency: payment.currency,
              amount: Number(payment.amount),
              provider: payment.provider,
              providerRef: payment.providerRef,
            });

            logger.info(
              `Successfully refunded payment ${payment.id} for booking ${payment.bookingId}`,
            );
            return "REFUNDED";
          } else if (payment.status === "INITIATED") {
            // No capture happened, just mark as failed
            await this.paymentRepository.update({ id: payment.id }, { status: "FAILED" });
            return "FAILED";
          }
          return "SKIPPED";
        } catch (error: unknown) {
          logger.error(`Failed to refund payment ${payment.id}: ${this.getErrorMessage(error)}`);
          return "ERROR";
        }
      }),
    );

    const refundedCount = results.filter((r) => r === "REFUNDED").length;
    const failedCount = results.filter((r) => r === "FAILED" || r === "ERROR").length;
    const skippedCount = results.filter((r) => r === "SKIPPED").length;

    return {
      refundedCount,
      failedCount,
      skippedCount,
    };
  }

  /**
   * Fails multiple initiation records in bulk.
   * Used in: Booking expiry cleanup flow
   * Triggered via: gRPC
   */
  async bulkFailPayments(bookingIds: string[]): Promise<number> {
    if (!bookingIds.length) return 0;
    return await this.paymentRepository.bulkFailPayments(bookingIds);
  }

  /**
   * Helper to send refund emails asynchronously.
   */
  private sendRefundEmail(payment: {
    userId: string;
    bookingId: string;
    currency: string;
    amount: number;
    provider: string;
    providerRef?: string | null;
  }) {
    this.userServiceGrpcClient
      .findUserById({ userId: payment.userId })
      .then((userRes) => {
        if (userRes.success && userRes.user) {
          this.emailService
            .sendEmail({
              to: userRes.user.email,
              subject: "Refund Processed - Event Booking Platform",
              text: `Hello ${userRes.user.name},\n\nYour refund of ${payment.currency} ${payment.amount} 
              for booking ${payment.bookingId} has been successfully processed via ${payment.provider}.
              \n\nReference: ${payment.providerRef}`,
            })
            .catch((e) =>
              logger.error(`Failed to send refund email to ${userRes.user?.email}: ${e.message}`),
            );
        }
      })
      .catch((e) => logger.error(`Failed to fetch user for refund email: ${e.message}`));
  }

  /**
   * Executes the Razorpay refund API call behind a circuit breaker.
   */
  private async executeRefundRazorpayPayment(
    paymentId: string,
    amount: number,
  ): Promise<Refunds.RazorpayRefund> {
    return this.razorpay.payments.refund(paymentId, {
      amount: amount * 100, // paisa
      notes: { reason: "Event Cancelled" },
    });
  }

  /**
   * Creates a provider order before the payment is attempted.
   * Used in: Booking payment-init flow
   * Triggered via: internal service call
   */
  private async createRazorpayOrder(amount: number): Promise<Orders.RazorpayOrder> {
    return this.createRazorpayOrderBreaker.fire(amount);
  }

  /**
   * Executes the provider order creation call behind the circuit breaker.
   * Used in: Booking payment-init flow
   * Triggered via: internal service call
   */
  private async executeCreateRazorpayOrder(amount: number): Promise<Orders.RazorpayOrder> {
    return this.razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });
  }

  async findPaymentByBookingId(bookingId: string) {
    const payment = await this.paymentRepository.findByBookingId(bookingId);
    if (!payment) {
      return null;
    }

    return {
      ...payment,
      amount: Number(payment.amount),
    };
  }

  async findPayment(id: string) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new ValidationError("Payment not found");
    }
    return {
      ...payment,
      amount: Number(payment.amount),
    };
  }

  /**
   * Refunds a successful payment and publishes a retryable settlement event that
   * cancels the booking and releases seats.
   * Used in: Payment refund flow
   * Triggered via: REST
   */
  async refundPayment(paymentId: string, actor?: AuthReq["user"], isInternal = false) {
    if (!paymentId) {
      throw new ValidationError("Payment id is required");
    }

    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError("Payment not found, Please try again later");
    }

    if (!isInternal && actor?.role !== "ADMIN" && actor?.id !== payment.userId) {
      throw new ForbiddenError("You are not allowed to refund this payment");
    }

    if (payment.status === "REFUNDED") {
      return {
        ...payment,
        amount: Number(payment.amount),
      };
    }

    if (payment.status !== "SUCCESS") {
      throw new ConflictError("Only successful payments can be refunded");
    }

    if (!payment.providerRef) {
      throw new ConflictError("Payment provider reference is missing");
    }

    await this.refundRazorpayPaymentBreaker.fire(payment.providerRef, Number(payment.amount));

    const refundedPayment = await this.unitOfWork.withTransaction(async (repos) => {
      const updatedPayment = await repos.paymentRepository.update(
        { id: payment.id },
        { status: "REFUNDED" },
      );

      if (!updatedPayment) {
        throw new ValidationError("Failed to update payment status, Please try again later");
      }

      await repos.paymentEventRepository.create({
        paymentId: payment.id,
        type: WEBHOOK_EVENT_TYPE.PAYMENT_REFUNDED,
        payload: {
          paymentId: payment.id,
          bookingId: payment.bookingId,
          providerRef: payment.providerRef,
        },
      });

      await repos.outboxEventRepository.create({
        topic: "payment.refunded",
        payload: {
          eventId: codeGenerator().code,
          paymentId: payment.id,
          bookingId: payment.bookingId,
        },
        status: "PENDING",
      });

      return updatedPayment;
    });

    this.sendRefundEmail({
      userId: refundedPayment.userId,
      bookingId: refundedPayment.bookingId,
      currency: refundedPayment.currency,
      amount: Number(refundedPayment.amount),
      provider: refundedPayment.provider,
      providerRef: refundedPayment.providerRef,
    });

    return {
      ...refundedPayment,
      amount: Number(refundedPayment.amount),
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }
}
