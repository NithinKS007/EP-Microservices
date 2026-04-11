import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  PaymentServiceClient,
  FindPaymentsByBookingIdsRequest,
  FindPaymentsByBookingIdsResponse,
  BulkFailPaymentsRequest,
  BulkFailPaymentsResponse,
} from "../../../utils/src";

export class PaymentServiceGrpcClient {
  private client = createGrpcClient(
    PaymentServiceClient,
    envConfig.PAYMENT_SERVICE_URL_GRPC || "payment:50054",
  );

  /**
   * Finds payments by booking ids.
   * Used in: Booking finding flow
   * Triggered via: gRPC
   */
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

  /**
   * Fails multiple initiation records in bulk.
   * Used in: Booking expiry cleanup flow
   * Triggered via: gRPC
   */
  bulkFailPayments(data: BulkFailPaymentsRequest): Promise<BulkFailPaymentsResponse> {
    return new Promise((resolve, reject) => {
      this.client.bulkFailPayments(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }
}
