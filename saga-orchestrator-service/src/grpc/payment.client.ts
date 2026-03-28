import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
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
  private client = createGrpcClient(
    PaymentServiceClient,
    envConfig.PAYMENT_SERVICE_URL_GRPC || "payment:50054",
  );

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
    return new Promise((resolve, reject) => {
      this.client.bulkRefundPayments(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }
}
