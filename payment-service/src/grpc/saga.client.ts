import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  executeUnaryGrpcCall,
  findCircuitBreakerPolicy,
} from "../../../utils/src";
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
    ...findCircuitBreakerPolicy("internalCommand", { timeoutMs: 9000 }),
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
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.startInitiatePaymentSaga(data, metadata, options, callback),
    });
  }
}
