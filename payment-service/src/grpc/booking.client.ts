import { envConfig } from "../config/env.config";
import { createCircuitBreaker, createGrpcClient, fromGrpcError, Metadata } from "../../../utils/src";
import {
  BookingServiceClient,
  UpdateBookingStatusRequest,
  UpdateBookingStatusResponse,
  BookingStatus,
} from "../../../utils/src";

export class BookingServiceGrpcClient {
  private readonly GRPC_TIMEOUT_MS = 4000;
  private client = createGrpcClient(
    BookingServiceClient,
    envConfig.BOOKING_SERVICE_URL_GRPC || "booking:50053",
  );
  private readonly updateBookingStatusBreaker = createCircuitBreaker<
    [UpdateBookingStatusRequest],
    UpdateBookingStatusResponse
  >({
    name: "payment.booking.update_status",
    timeoutMs: 5000,
    action: (data) => this.executeUpdateBookingStatus(data),
  });

  /**
   * Updates booking status from payment event processing.
   * Used in: Payment success and failure finalization flow
   * Triggered via: gRPC
   */
  updateBookingStatus(data: UpdateBookingStatusRequest): Promise<UpdateBookingStatusResponse> {
    return this.updateBookingStatusBreaker.fire(data);
  }

  /**
   * Executes the raw booking status gRPC call with a deadline.
   * Used in: Payment success and failure finalization flow
   * Triggered via: gRPC
   */
  private executeUpdateBookingStatus(
    data: UpdateBookingStatusRequest,
  ): Promise<UpdateBookingStatusResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateBookingStatus(
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

export { BookingStatus };
