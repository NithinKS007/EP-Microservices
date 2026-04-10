import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
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
  private client = createGrpcClient(
    EventServiceClient,
    envConfig.EVENT_SERVICE_URL_GRPC || "event:50052",
  );

  /**
   * Releases seats for expired bookings.
   * Used in: Booking expiry cleanup flow
   * Triggered via: gRPC
   */
  bulkReleaseSeats(data: BulkReleaseSeatsRequest): Promise<BulkReleaseSeatsResponse> {
    return new Promise((resolve, reject) => {
      this.client.bulkReleaseSeats(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  /**
   * Finds events by ids with seats.
   * Used in: Booking finding flow
   * Triggered via: gRPC
   */
  findEventsByIdsWithSeats(
    data: FindEventsByIdsWithSeatsRequest,
  ): Promise<FindEventsByIdsWithSeatsResponse> {
    return new Promise((resolve, reject) => {
      this.client.findEventsByIdsWithSeats(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  /**
   * Confirms seats for a booking after a successful payment settlement.
   * Used in: Booking manual confirm flow
   * Triggered via: gRPC
   */
  confirmSeats(data: ConfirmSeatsRequest): Promise<ConfirmSeatsResponse> {
    return new Promise((resolve, reject) => {
      this.client.confirmSeats(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }
}
