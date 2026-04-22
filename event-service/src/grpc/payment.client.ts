import { envConfig } from "../config/env.config";
import { createCircuitBreaker, createGrpcClient, executeUnaryGrpcCall } from "../../../utils/src";
import {
  BulkRefundPaymentsRequest,
  BulkRefundPaymentsResponse,
  FindPaymentsByBookingIdsRequest,
  FindPaymentsByBookingIdsResponse,
  PaymentServiceClient,
  UpdatePaymentStatusRequest,
  UpdatePaymentStatusResponse,
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
    name: "event.payment.find_by_booking_ids",
    timeoutMs: 5000,
    action: (data) => this.executeFindPaymentsByBookingIds(data),
  });
  private readonly updatePaymentStatusBreaker = createCircuitBreaker<
    [UpdatePaymentStatusRequest],
    UpdatePaymentStatusResponse
  >({
    name: "event.payment.update_status",
    timeoutMs: 5000,
    action: (data) => this.executeUpdatePaymentStatus(data),
  });
  private readonly bulkRefundPaymentsBreaker = createCircuitBreaker<
    [BulkRefundPaymentsRequest],
    BulkRefundPaymentsResponse
  >({
    name: "event.payment.bulk_refund",
    timeoutMs: 11000,
    action: (data) => this.executeBulkRefundPayments(data),
  });

  findPaymentsByBookingIds(
    data: FindPaymentsByBookingIdsRequest,
  ): Promise<FindPaymentsByBookingIdsResponse> {
    return this.findPaymentsByBookingIdsBreaker.fire(data);
  }

  updatePaymentStatus(data: UpdatePaymentStatusRequest): Promise<UpdatePaymentStatusResponse> {
    return this.updatePaymentStatusBreaker.fire(data);
  }

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

  private executeUpdatePaymentStatus(
    data: UpdatePaymentStatusRequest,
  ): Promise<UpdatePaymentStatusResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.updatePaymentStatus(data, metadata, options, callback),
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
