import { envConfig } from "../config/env.config";
import { createCircuitBreaker, createGrpcClient, fromGrpcError, Metadata } from "../../../utils/src";
import {
  SagaServiceClient,
  StartInitiatePaymentSagaRequest,
  StartInitiatePaymentSagaResponse,
} from "../../../utils/src";

export class SagaServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 8000;
  private client = createGrpcClient(
    SagaServiceClient,
    envConfig.SAGA_SERVICE_URL_GRPC || "saga-orchestrator:50055",
  );
  private readonly startInitiatePaymentSagaBreaker = createCircuitBreaker<
    [StartInitiatePaymentSagaRequest],
    StartInitiatePaymentSagaResponse
  >({
    name: "payment.saga.start_initiate_payment",
    timeoutMs: 9000,
    action: (data) => this.executeStartInitiatePaymentSaga(data),
  });

  startInitiatePaymentSaga(
    data: StartInitiatePaymentSagaRequest,
  ): Promise<StartInitiatePaymentSagaResponse> {
    return this.startInitiatePaymentSagaBreaker.fire(data);
  }

  private executeStartInitiatePaymentSaga(
    data: StartInitiatePaymentSagaRequest,
  ): Promise<StartInitiatePaymentSagaResponse> {
    return new Promise((resolve, reject) => {
      this.client.startInitiatePaymentSaga(
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
