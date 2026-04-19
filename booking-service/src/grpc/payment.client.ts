import { envConfig } from "../config/env.config";
import { createCircuitBreaker, createGrpcClient, executeUnaryGrpcCall } from "../../../utils/src";
import {
  PaymentServiceClient,
  FindPaymentsByBookingIdsRequest,
  FindPaymentsByBookingIdsResponse,
  BulkFailPaymentsRequest,
  BulkFailPaymentsResponse,
  BulkRefundPaymentsRequest,
  BulkRefundPaymentsResponse,
} from "../../../utils/src";

export class PaymentServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 4000;
  private readonly REFUND_TIMEOUT_MS = 10000;
  private client = createGrpcClient(
    PaymentServiceClient,
    envConfig.PAYMENT_SERVICE_URL_GRPC || "payment:50054",
  );
  private readonly findPaymentsByBookingIdsBreaker = createCircuitBreaker<
    [FindPaymentsByBookingIdsRequest],
    FindPaymentsByBookingIdsResponse
  >({
    name: "booking.payment.find_by_booking_ids",
    timeoutMs: 5000,
    action: (data) => this.executeFindPaymentsByBookingIds(data),
  });
  private readonly bulkFailPaymentsBreaker = createCircuitBreaker<
    [BulkFailPaymentsRequest],
    BulkFailPaymentsResponse
  >({
    name: "booking.payment.bulk_fail",
    timeoutMs: 5000,
    action: (data) => this.executeBulkFailPayments(data),
  });
  private readonly bulkRefundPaymentsBreaker = createCircuitBreaker<
    [BulkRefundPaymentsRequest],
    BulkRefundPaymentsResponse
  >({
    name: "booking.payment.bulk_refund",
    timeoutMs: 11000,
    action: (data) => this.executeBulkRefundPayments(data),
  });

  /**
   * Finds payments by booking ids.
   * Used in: Booking finding flow
   * Triggered via: gRPC
   */
  findPaymentsByBookingIds(
    data: FindPaymentsByBookingIdsRequest,
  ): Promise<FindPaymentsByBookingIdsResponse> {
    return this.findPaymentsByBookingIdsBreaker.fire(data);
  }

  /**
   * Fails multiple initiation records in bulk.
   * Used in: Booking expiry cleanup flow
   * Triggered via: gRPC
   */
  bulkFailPayments(data: BulkFailPaymentsRequest): Promise<BulkFailPaymentsResponse> {
    return this.bulkFailPaymentsBreaker.fire(data);
  }

  /**
   * Reconciles payments in bulk for a cancelled booking.
   * Used in: Booking cancellation flow
   * Triggered via: internal service call
   */
  bulkRefundPayments(data: BulkRefundPaymentsRequest): Promise<BulkRefundPaymentsResponse> {
    return this.bulkRefundPaymentsBreaker.fire(data);
  }

  private executeFindPaymentsByBookingIds(
    data: FindPaymentsByBookingIdsRequest,
  ): Promise<FindPaymentsByBookingIdsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.findPaymentsByBookingIds(data, metadata, options, callback),
    });
  }

  private executeBulkFailPayments(
    data: BulkFailPaymentsRequest,
  ): Promise<BulkFailPaymentsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.bulkFailPayments(data, metadata, options, callback),
    });
  }

  private executeBulkRefundPayments(
    data: BulkRefundPaymentsRequest,
  ): Promise<BulkRefundPaymentsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.REFUND_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.bulkRefundPayments(data, metadata, options, callback),
    });
  }
}
