import { envConfig } from "../config/env.config";
import { createCircuitBreaker, createGrpcClient, fromGrpcError, Metadata } from "../../../utils/src";
import {
  SagaServiceClient,
  StartCancelEventSagaRequest,
  StartCancelEventSagaResponse,
} from "../../../utils/src";

export class SagaServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 4000;
  private client = createGrpcClient(
    SagaServiceClient,
    envConfig.SAGA_SERVICE_URL_GRPC || "saga-orchestrator:50055",
  );
  private readonly startCancelEventSagaBreaker = createCircuitBreaker<
    [StartCancelEventSagaRequest],
    StartCancelEventSagaResponse
  >({
    name: "event.saga.start_cancel_event",
    timeoutMs: 5000,
    action: (data) => this.executeStartCancelEventSaga(data),
  });

  startCancelEventSaga(data: StartCancelEventSagaRequest): Promise<StartCancelEventSagaResponse> {
    return this.startCancelEventSagaBreaker.fire(data);
  }

  /**
   * Executes the raw saga-start gRPC call with a deadline.
   * Used in: Cancel Event Saga start
   * Triggered via: gRPC
   */
  private executeStartCancelEventSaga(
    data: StartCancelEventSagaRequest,
  ): Promise<StartCancelEventSagaResponse> {
    return new Promise((resolve, reject) => {
      this.client.startCancelEventSaga(
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
