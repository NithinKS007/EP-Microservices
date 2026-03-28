import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  BulkReleaseSeatsRequest,
  BulkReleaseSeatsResponse,
  EventServiceClient,
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
}
