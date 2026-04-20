import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  executeUnaryGrpcCall,
  findCircuitBreakerPolicy,
} from "../../../utils/src";
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
    ...findCircuitBreakerPolicy("internalCommand"),
    action: (data) => this.executeBulkReleaseSeats(data),
  });
  private readonly markEventCancelledBreaker = createCircuitBreaker<
    [MarkEventCancelledRequest],
    MarkEventCancelledResponse
  >({
    name: "saga.event.mark_cancelled",
    ...findCircuitBreakerPolicy("internalCommand"),
    action: (data) => this.executeMarkEventCancelled(data),
  });
  private readonly lockSeatsBreaker = createCircuitBreaker<[LockSeatsRequest], LockSeatsResponse>({
    name: "saga.event.lock_seats",
    ...findCircuitBreakerPolicy("internalCommand"),
    action: (data) => this.executeLockSeats(data),
  });
  private readonly confirmSeatsBreaker = createCircuitBreaker<
    [ConfirmSeatsRequest],
    ConfirmSeatsResponse
  >({
    name: "saga.event.confirm_seats",
    ...findCircuitBreakerPolicy("internalCommand"),
    action: (data) => this.executeConfirmSeats(data),
  });
  private readonly releaseSeatsBreaker = createCircuitBreaker<
    [ReleaseSeatsRequest],
    ReleaseSeatsResponse
  >({
    name: "saga.event.release_seats",
    ...findCircuitBreakerPolicy("internalCommand"),
    action: (data) => this.executeReleaseSeats(data),
  });

  lockSeats(data: LockSeatsRequest): Promise<LockSeatsResponse> {
    return this.lockSeatsBreaker.fire(data);
  }

  confirmSeats(data: ConfirmSeatsRequest): Promise<ConfirmSeatsResponse> {
    return this.confirmSeatsBreaker.fire(data);
  }

  releaseSeats(data: ReleaseSeatsRequest): Promise<ReleaseSeatsResponse> {
    return this.releaseSeatsBreaker.fire(data);
  }

  bulkReleaseSeats(data: BulkReleaseSeatsRequest): Promise<BulkReleaseSeatsResponse> {
    return this.bulkReleaseSeatsBreaker.fire(data);
  }

  private executeBulkReleaseSeats(
    data: BulkReleaseSeatsRequest,
  ): Promise<BulkReleaseSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.bulkReleaseSeats(data, metadata, options, callback),
    });
  }

  markEventCancelled(data: MarkEventCancelledRequest): Promise<MarkEventCancelledResponse> {
    return this.markEventCancelledBreaker.fire(data);
  }

  private executeMarkEventCancelled(
    data: MarkEventCancelledRequest,
  ): Promise<MarkEventCancelledResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.markEventCancelled(data, metadata, options, callback),
    });
  }

  private executeLockSeats(data: LockSeatsRequest): Promise<LockSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.lockSeats(data, metadata, options, callback),
    });
  }

  private executeConfirmSeats(data: ConfirmSeatsRequest): Promise<ConfirmSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.confirmSeats(data, metadata, options, callback),
    });
  }

  private executeReleaseSeats(data: ReleaseSeatsRequest): Promise<ReleaseSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.releaseSeats(data, metadata, options, callback),
    });
  }
}
