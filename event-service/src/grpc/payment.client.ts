import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  FindPaymentsByBookingIdsRequest,
  FindPaymentsByBookingIdsResponse,
  PaymentServiceClient,
  UpdatePaymentStatusRequest,
  UpdatePaymentStatusResponse,
} from "../../../utils/src";

export class PaymentServiceGrpcClient {
  private client = createGrpcClient(
    PaymentServiceClient,
    envConfig.PAYMENT_SERVICE_URL_GRPC || "payment:50054",
  );

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

  updatePaymentStatus(data: UpdatePaymentStatusRequest): Promise<UpdatePaymentStatusResponse> {
    return new Promise((resolve, reject) => {
      this.client.updatePaymentStatus(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }
}
