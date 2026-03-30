import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  PaymentServiceClient,
  FindPaymentsByBookingIdsRequest,
  FindPaymentsByBookingIdsResponse,
} from "../../../utils/src";

export class PaymentServiceGrpcClient {
  private client = createGrpcClient(
    PaymentServiceClient,
    envConfig.PAYMENT_SERVICE_URL_GRPC || "event:50052",
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
}
