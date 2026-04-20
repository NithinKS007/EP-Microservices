import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  executeUnaryGrpcCall,
  findCircuitBreakerPolicy,
} from "../../../utils/src";
import {
  BulkRefundPaymentsRequest,
  BulkRefundPaymentsResponse,
  CreatePaymentRequest,
  CreatePaymentResponse,
  FindPaymentsByBookingIdsRequest,
  FindPaymentsByBookingIdsResponse,
  PaymentServiceClient,
} from "../../../utils/src";

export class PaymentServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 4000;
  private readonly CREATE_PAYMENT_TIMEOUT_MS = 10000;
  private readonly BULK_REFUND_TIMEOUT_MS = 15000;
  private client = createGrpcClient(
    PaymentServiceClient,
    envConfig.PAYMENT_SERVICE_URL_GRPC || "payment:50054",
  );
  private readonly createPaymentBreaker = createCircuitBreaker<
    [CreatePaymentRequest],
    CreatePaymentResponse
  >({
    name: "saga.payment.create_payment",
    ...findCircuitBreakerPolicy("internalCommand", { timeoutMs: 11000 }),
    action: (data) => this.executeCreatePayment(data),
  });
  private readonly findPaymentsByBookingIdsBreaker = createCircuitBreaker<
    [FindPaymentsByBookingIdsRequest],
    FindPaymentsByBookingIdsResponse
  >({
    name: "saga.payment.find_by_booking_ids",
    ...findCircuitBreakerPolicy("internalQuery"),
    action: (data) => this.executeFindPaymentsByBookingIds(data),
  });
  private readonly bulkRefundPaymentsBreaker = createCircuitBreaker<
    [BulkRefundPaymentsRequest],
    BulkRefundPaymentsResponse
  >({
    name: "saga.payment.bulk_refund",
    ...findCircuitBreakerPolicy("internalCommand", { timeoutMs: 16000 }),
    action: (data) => this.executeBulkRefundPayments(data),
  });

  createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.createPaymentBreaker.fire(data);
  }

  findPaymentsByBookingIds(
    data: FindPaymentsByBookingIdsRequest,
  ): Promise<FindPaymentsByBookingIdsResponse> {
    return this.findPaymentsByBookingIdsBreaker.fire(data);
  }

  bulkRefundPayments(data: BulkRefundPaymentsRequest): Promise<BulkRefundPaymentsResponse> {
    return this.bulkRefundPaymentsBreaker.fire(data);
  }

  private executeBulkRefundPayments(
    data: BulkRefundPaymentsRequest,
  ): Promise<BulkRefundPaymentsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.BULK_REFUND_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.bulkRefundPayments(data, metadata, options, callback),
    });
  }

  private executeCreatePayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.CREATE_PAYMENT_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.createPayment(data, metadata, options, callback),
    });
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
}
