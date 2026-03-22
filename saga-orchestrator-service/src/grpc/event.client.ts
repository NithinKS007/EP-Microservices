import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  LockSeatsRequest,
  LockSeatsResponse,
  ConfirmSeatsRequest,
  ConfirmSeatsResponse,
  ReleaseSeatsRequest,
  ReleaseSeatsResponse,
  EventServiceClient,
} from "../../../utils/src";

export class EventServiceGrpcClient {
  private client = createGrpcClient(
    EventServiceClient,
    envConfig.EVENT_SERVICE_URL_GRPC || "event:50052",
  );

  lockSeats(data: LockSeatsRequest): Promise<LockSeatsResponse> {
    return new Promise((resolve, reject) => {
      this.client.lockSeats(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  confirmSeats(data: ConfirmSeatsRequest): Promise<ConfirmSeatsResponse> {
    return new Promise((resolve, reject) => {
      this.client.confirmSeats(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  releaseSeats(data: ReleaseSeatsRequest): Promise<ReleaseSeatsResponse> {
    return new Promise((resolve, reject) => {
      this.client.releaseSeats(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }
}
