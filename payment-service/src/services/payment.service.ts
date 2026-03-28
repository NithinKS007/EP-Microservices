import { ValidationError } from "../../../utils/src/error.handling.middleware";
import { IPaymentRepository } from "../interface/IPayment.repository";
import { IPaymentEventRepository } from "../interface/IPayment.event.repository";
import { codeGenerator, KafkaService, logger } from "../../../utils/src/index";
import { CreatePaymentDto, WEBHOOK_EVENT_TYPE } from "../dtos/payment..dtos";
import { envConfig } from "../config/env.config";
import Razorpay from "razorpay";
import { UnitOfWork } from "../repositories/unity.of.work";
import { PaymentStatus } from "../generated/prisma/client";

export class PaymentService {
  private readonly paymentRepository: IPaymentRepository;
  private readonly paymentEventRepository: IPaymentEventRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly kafkaService: KafkaService;

  constructor({
    paymentRepository,
    paymentEventRepository,
    unitOfWork,
    kafkaService,
  }: {
    paymentRepository: IPaymentRepository;
    paymentEventRepository: IPaymentEventRepository;
    unitOfWork: UnitOfWork;
    kafkaService: KafkaService;
  }) {
    this.paymentRepository = paymentRepository;
    this.paymentEventRepository = paymentEventRepository;
    this.unitOfWork = unitOfWork;
    this.kafkaService = kafkaService;
  }

  /**
   * Creates a payment initiation record and provider order.
   * Used in: Booking payment-init flow
   * Triggered via: REST / gRPC
   */
  async create({ amount, bookingId, currency, provider, userId, providerRef }: CreatePaymentDto) {
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

    if (existing.status === "SUCCESS") {
      logger.warn(
        `Payment already captured ORDER_ID ${payload.order_id} PAYLOAD PAYMENT_ID ${existing.id}`,
      );
      return;
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

    if (existing.status === "SUCCESS") {
      logger.warn(
        `Payment already captured ORDER_ID ${payload.order_id} PAYLOAD PAYMENT_ID ${existing.id}`,
      );
      return;
    }

    await this.unitOfWork.withTransaction(async (repos) => {
      await this.paymentRepository.update({ id: existing.id }, { status: "FAILED" });

      await this.paymentEventRepository.create({
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
    const { refundedCount, failedCount } = await this.paymentRepository.bulkRefundPayments(bookingIds);

    return {
      refundedCount,
      failedCount,
      skippedCount: existingPayments.length - refundedCount - failedCount,
    };
  }

  /**
   * Creates a provider order before the payment is attempted.
   * Used in: Booking payment-init flow
   * Triggered via: internal service call
   */
  private async createRazorpayOrder(amount: number) {
    const razorpay = new Razorpay({
      key_id: envConfig.RAZORPAY_KEY_ID,
      key_secret: envConfig.RAZORPAY_KEY_SECRET,
    });
    return razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });
  }
}
