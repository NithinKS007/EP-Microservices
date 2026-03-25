import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
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
}
