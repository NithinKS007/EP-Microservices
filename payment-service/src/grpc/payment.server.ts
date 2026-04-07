import { PaymentService } from "../services/payment.service";
import {
  toGrpcError,
  CreatePaymentRequest,
  CreatePaymentResponse,
  FindPaymentsByBookingIdsRequest,
  FindPaymentsByBookingIdsResponse,
  UpdatePaymentStatusRequest,
  UpdatePaymentStatusResponse,
  BulkRefundPaymentsRequest,
  BulkRefundPaymentsResponse,
  PaymentStatus as GrpcPaymentStatus,
} from "../../../utils/src/index";
import { ServerUnaryCall, SendUnaryData } from "../../../utils/src/index";
import { PaymentStatus as EntityPaymentStatus } from "../generated/prisma/client";

export class PaymentGrpcController {
  private readonly paymentService: PaymentService;
  constructor({ paymentService }: { paymentService: PaymentService }) {
    this.paymentService = paymentService;
  }

  createPayment(
    call: ServerUnaryCall<CreatePaymentRequest, CreatePaymentResponse>,
    callback: SendUnaryData<CreatePaymentResponse>,
  ): void {
    const { amount, bookingId, currency, provider, userId } = call.request;
    this.paymentService
      .create({
        amount,
        bookingId,
        currency,
        provider,
        userId,
      })
      .then((result) =>
        callback(null, {
          success: true,
          message: "Payment created successfully",
          paymentId: result.paymentId,
          razorpayOrderId: result.razorpayOrderId,
          amount: Number(result.amount),
          currency: result.currency,
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  findPaymentsByBookingIds(
    call: ServerUnaryCall<FindPaymentsByBookingIdsRequest, FindPaymentsByBookingIdsResponse>,
    callback: SendUnaryData<FindPaymentsByBookingIdsResponse>,
  ): void {
    const { bookingIds } = call.request;
    this.paymentService
      .findPaymentsByBookingIds(bookingIds)
      .then((payments) =>
        callback(null, {
          success: true,
          message: "Payments found successfully",
          payments: payments.map((payment) => ({
            ...payment,
            status: this.mapPaymentStatusToGrpc(payment.status),
            providerRef: payment.providerRef || "",
          })),
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  updatePaymentStatus(
    call: ServerUnaryCall<UpdatePaymentStatusRequest, UpdatePaymentStatusResponse>,
    callback: SendUnaryData<UpdatePaymentStatusResponse>,
  ): void {
    const { paymentId, status } = call.request;
    this.paymentService
      .updatePaymentStatus(paymentId, this.mapGrpcStatusToEntity(status))
      .then(() =>
        callback(null, {
          success: true,
          message: "Payment status updated successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  bulkRefundPayments(
    call: ServerUnaryCall<BulkRefundPaymentsRequest, BulkRefundPaymentsResponse>,
    callback: SendUnaryData<BulkRefundPaymentsResponse>,
  ): void {
    const { bookingIds } = call.request;
    this.paymentService
      .bulkRefundPayments(bookingIds)
      .then((result) =>
        callback(null, {
          success: true,
          message: "Payments reconciled successfully",
          refundedCount: result.refundedCount,
          failedCount: result.failedCount,
          skippedCount: result.skippedCount,
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  private mapPaymentStatusToGrpc(status: EntityPaymentStatus): GrpcPaymentStatus {
    switch (status) {
      case EntityPaymentStatus.INITIATED:
        return GrpcPaymentStatus.PAYMENT_STATUS_INITIATED;
      case EntityPaymentStatus.SUCCESS:
        return GrpcPaymentStatus.PAYMENT_STATUS_SUCCESS;
      case EntityPaymentStatus.FAILED:
        return GrpcPaymentStatus.PAYMENT_STATUS_FAILED;
      case EntityPaymentStatus.REFUNDED:
        return GrpcPaymentStatus.PAYMENT_STATUS_REFUNDED;
      default:
        return GrpcPaymentStatus.PAYMENT_STATUS_UNSPECIFIED;
    }
  }

  private mapGrpcStatusToEntity(status: GrpcPaymentStatus): EntityPaymentStatus {
    switch (status) {
      case GrpcPaymentStatus.PAYMENT_STATUS_INITIATED:
        return EntityPaymentStatus.INITIATED;
      case GrpcPaymentStatus.PAYMENT_STATUS_SUCCESS:
        return EntityPaymentStatus.SUCCESS;
      case GrpcPaymentStatus.PAYMENT_STATUS_FAILED:
        return EntityPaymentStatus.FAILED;
      case GrpcPaymentStatus.PAYMENT_STATUS_REFUNDED:
        return EntityPaymentStatus.REFUNDED;
      default:
        return EntityPaymentStatus.INITIATED;
    }
  }
}
