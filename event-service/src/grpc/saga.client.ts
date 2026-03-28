import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  SagaServiceClient,
  StartCancelEventSagaRequest,
  StartCancelEventSagaResponse,
} from "../../../utils/src";

export class SagaServiceGrpcClient {
  private client = createGrpcClient(
    SagaServiceClient,
    envConfig.SAGA_SERVICE_URL_GRPC || "saga-orchestrator:50055",
  );

  startCancelEventSaga(data: StartCancelEventSagaRequest): Promise<StartCancelEventSagaResponse> {
    return new Promise((resolve, reject) => {
      this.client.startCancelEventSaga(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }
}
