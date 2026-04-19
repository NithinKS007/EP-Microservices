import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  executeUnaryGrpcCall,
} from "../../../utils/src";
import {
  BulkReleaseSeatsRequest,
  BulkReleaseSeatsResponse,
  LockSeatsRequest,
  LockSeatsResponse,
  ConfirmSeatsRequest,
  ConfirmSeatsResponse,
  EventServiceClient,
  ReleaseSeatsRequest,
  ReleaseSeatsResponse,
} from "../../../utils/src";

export class EventServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 4000;
  private client = createGrpcClient(
    EventServiceClient,
    envConfig.EVENT_SERVICE_URL_GRPC || "event:50052",
  );
  private readonly lockSeatsBreaker = createCircuitBreaker<[LockSeatsRequest], LockSeatsResponse>({
    name: "payment.event.lock_seats",
    timeoutMs: 5000,
    action: (data) => this.executeLockSeats(data),
  });
  private readonly confirmSeatsBreaker = createCircuitBreaker<
    [ConfirmSeatsRequest],
    ConfirmSeatsResponse
  >({
    name: "payment.event.confirm_seats",
    timeoutMs: 5000,
    action: (data) => this.executeConfirmSeats(data),
  });
  private readonly releaseSeatsBreaker = createCircuitBreaker<
    [ReleaseSeatsRequest],
    ReleaseSeatsResponse
  >({
    name: "payment.event.release_seats",
    timeoutMs: 5000,
    action: (data) => this.executeReleaseSeats(data),
  });
  private readonly bulkReleaseSeatsBreaker = createCircuitBreaker<
    [BulkReleaseSeatsRequest],
    BulkReleaseSeatsResponse
  >({
    name: "payment.event.bulk_release_seats",
    timeoutMs: 5000,
    action: (data) => this.executeBulkReleaseSeats(data),
  });

  /**
   * Locks seats before a payment order is created.
   * Used in: Payment initiation flow
   * Triggered via: gRPC
   */
  lockSeats(data: LockSeatsRequest): Promise<LockSeatsResponse> {
    return this.lockSeatsBreaker.fire(data);
  }

  /**
   * Confirms locked seats after payment success.
   * Used in: Payment success finalization flow
   * Triggered via: gRPC
   */
  confirmSeats(data: ConfirmSeatsRequest): Promise<ConfirmSeatsResponse> {
    return this.confirmSeatsBreaker.fire(data);
  }

  /**
   * Executes the raw confirm-seats gRPC call with a deadline.
   * Used in: Payment success finalization flow
   * Triggered via: gRPC
   */
  private executeConfirmSeats(data: ConfirmSeatsRequest): Promise<ConfirmSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.confirmSeats(data, metadata, options, callback),
    });
  }

  /**
   * Releases locked seats after payment failure.
   * Used in: Payment failure compensation flow
   * Triggered via: gRPC
   */
  releaseSeats(data: ReleaseSeatsRequest): Promise<ReleaseSeatsResponse> {
    return this.releaseSeatsBreaker.fire(data);
  }

  /**
   * Executes the raw release-seats gRPC call with a deadline.
   * Used in: Payment failure compensation flow
   * Triggered via: gRPC
   */
  private executeReleaseSeats(data: ReleaseSeatsRequest): Promise<ReleaseSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.releaseSeats(data, metadata, options, callback),
    });
  }

  /**
   * Releases all seats linked to the provided bookings, including sold seats.
   * Used in: Payment refund compensation flow
   * Triggered via: gRPC
   */
  bulkReleaseSeats(data: BulkReleaseSeatsRequest): Promise<BulkReleaseSeatsResponse> {
    return this.bulkReleaseSeatsBreaker.fire(data);
  }

  private executeLockSeats(data: LockSeatsRequest): Promise<LockSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.lockSeats(data, metadata, options, callback),
    });
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
}
