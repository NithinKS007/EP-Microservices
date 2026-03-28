import { envConfig } from "../config/env.config";
import { createCircuitBreaker, createGrpcClient, fromGrpcError, Metadata } from "../../../utils/src";
import {
  BulkReleaseSeatsRequest,
  BulkReleaseSeatsResponse,
  LockSeatsRequest,
  LockSeatsResponse,
  MarkEventCancelledRequest,
  MarkEventCancelledResponse,
  ConfirmSeatsRequest,
  ConfirmSeatsResponse,
  ReleaseSeatsRequest,
  ReleaseSeatsResponse,
  EventServiceClient,
} from "../../../utils/src";

export class EventServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 4000;
  private client = createGrpcClient(
    EventServiceClient,
    envConfig.EVENT_SERVICE_URL_GRPC || "event:50052",
  );
  private readonly bulkReleaseSeatsBreaker = createCircuitBreaker<
    [BulkReleaseSeatsRequest],
    BulkReleaseSeatsResponse
  >({
    name: "saga.event.bulk_release_seats",
    timeoutMs: 5000,
    action: (data) => this.executeBulkReleaseSeats(data),
  });
  private readonly markEventCancelledBreaker = createCircuitBreaker<
    [MarkEventCancelledRequest],
    MarkEventCancelledResponse
  >({
    name: "saga.event.mark_cancelled",
    timeoutMs: 5000,
    action: (data) => this.executeMarkEventCancelled(data),
  });

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

  bulkReleaseSeats(data: BulkReleaseSeatsRequest): Promise<BulkReleaseSeatsResponse> {
    return this.bulkReleaseSeatsBreaker.fire(data);
  }

  private executeBulkReleaseSeats(
    data: BulkReleaseSeatsRequest,
  ): Promise<BulkReleaseSeatsResponse> {
    return new Promise((resolve, reject) => {
      this.client.bulkReleaseSeats(
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

  markEventCancelled(data: MarkEventCancelledRequest): Promise<MarkEventCancelledResponse> {
    return this.markEventCancelledBreaker.fire(data);
  }

  private executeMarkEventCancelled(
    data: MarkEventCancelledRequest,
  ): Promise<MarkEventCancelledResponse> {
    return new Promise((resolve, reject) => {
      this.client.markEventCancelled(
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
