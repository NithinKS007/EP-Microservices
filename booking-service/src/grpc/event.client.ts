import { envConfig } from "../config/env.config";
import { createCircuitBreaker, createGrpcClient, executeUnaryGrpcCall } from "../../../utils/src";
import {
  BulkReleaseSeatsRequest,
  BulkReleaseSeatsResponse,
  ConfirmSeatsRequest,
  ConfirmSeatsResponse,
  EventServiceClient,
  FindEventsByIdsWithSeatsRequest,
  FindEventsByIdsWithSeatsResponse,
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
    name: "booking.event.bulk_release_seats",
    timeoutMs: 5000,
    action: (data) => this.executeBulkReleaseSeats(data),
  });
  private readonly findEventsByIdsWithSeatsBreaker = createCircuitBreaker<
    [FindEventsByIdsWithSeatsRequest],
    FindEventsByIdsWithSeatsResponse
  >({
    name: "booking.event.find_events_with_seats",
    timeoutMs: 5000,
    action: (data) => this.executeFindEventsByIdsWithSeats(data),
  });
  private readonly confirmSeatsBreaker = createCircuitBreaker<
    [ConfirmSeatsRequest],
    ConfirmSeatsResponse
  >({
    name: "booking.event.confirm_seats",
    timeoutMs: 5000,
    action: (data) => this.executeConfirmSeats(data),
  });

  /**
   * Releases seats for expired bookings.
   * Used in: Booking expiry cleanup flow
   * Triggered via: gRPC
   */
  bulkReleaseSeats(data: BulkReleaseSeatsRequest): Promise<BulkReleaseSeatsResponse> {
    return this.bulkReleaseSeatsBreaker.fire(data);
  }

  /**
   * Finds events by ids with seats.
   * Used in: Booking finding flow
   * Triggered via: gRPC
   */
  findEventsByIdsWithSeats(
    data: FindEventsByIdsWithSeatsRequest,
  ): Promise<FindEventsByIdsWithSeatsResponse> {
    return this.findEventsByIdsWithSeatsBreaker.fire(data);
  }

  /**
   * Confirms seats for a booking after a successful payment settlement.
   * Used in: Booking manual confirm flow
   * Triggered via: gRPC
   */
  confirmSeats(data: ConfirmSeatsRequest): Promise<ConfirmSeatsResponse> {
    return this.confirmSeatsBreaker.fire(data);
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

  private executeFindEventsByIdsWithSeats(
    data: FindEventsByIdsWithSeatsRequest,
  ): Promise<FindEventsByIdsWithSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.findEventsByIdsWithSeats(data, metadata, options, callback),
    });
  }

  private executeConfirmSeats(data: ConfirmSeatsRequest): Promise<ConfirmSeatsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.confirmSeats(data, metadata, options, callback),
    });
  }
}
