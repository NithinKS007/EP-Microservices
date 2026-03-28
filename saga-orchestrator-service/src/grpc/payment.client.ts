import { envConfig } from "../config/env.config";
import { createCircuitBreaker, createGrpcClient, fromGrpcError, Metadata } from "../../../utils/src";
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
  private client = createGrpcClient(
    PaymentServiceClient,
    envConfig.PAYMENT_SERVICE_URL_GRPC || "payment:50054",
  );
  private readonly bulkRefundPaymentsBreaker = createCircuitBreaker<
    [BulkRefundPaymentsRequest],
    BulkRefundPaymentsResponse
  >({
    name: "saga.payment.bulk_refund",
    timeoutMs: 5000,
    action: (data) => this.executeBulkRefundPayments(data),
  });

  createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return new Promise((resolve, reject) => {
      this.client.createPayment(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  findPaymentsByBookingIds(
    data: FindPaymentsByBookingIdsRequest,
  ): Promise<FindPaymentsByBookingIdsResponse> {
    return new Promise((resolve, reject) => {
      this.client.findPaymentsByBookingIds(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  bulkRefundPayments(data: BulkRefundPaymentsRequest): Promise<BulkRefundPaymentsResponse> {
    return this.bulkRefundPaymentsBreaker.fire(data);
  }

  private executeBulkRefundPayments(
    data: BulkRefundPaymentsRequest,
  ): Promise<BulkRefundPaymentsResponse> {
    return new Promise((resolve, reject) => {
      this.client.bulkRefundPayments(
        data,
        new Metadata(),
        { deadline: new Date(Date.now() + this.GRPC_TIMEOUT_MS) },
        (err, res) => {
          if (err) return reject(fromGrpcError(err));
          resolve(res);
        },
      );
    });
  }
}
