import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  BulkCancelBookingsRequest,
  BulkCancelBookingsResponse,
  FindBookingRequest,
  FindBookingResponse,
  FindBookingsByEventRequest,
  FindBookingsByEventResponse,
  UpdateBookingStatusRequest,
  UpdateBookingStatusResponse,
  UpdateBookingAmountRequest,
  UpdateBookingAmountResponse,
  BookingServiceClient,
} from "../../../utils/src";

export class BookingServiceGrpcClient {
  private client = createGrpcClient(
    BookingServiceClient,
    envConfig.BOOKING_SERVICE_URL_GRPC || "booking:50053",
  );

  findBooking(data: FindBookingRequest): Promise<FindBookingResponse> {
    return new Promise((resolve, reject) => {
      this.client.findBooking(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  findBookingsByEvent(data: FindBookingsByEventRequest): Promise<FindBookingsByEventResponse> {
    return new Promise((resolve, reject) => {
      this.client.findBookingsByEvent(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  updateBookingStatus(data: UpdateBookingStatusRequest): Promise<UpdateBookingStatusResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateBookingStatus(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  bulkCancelBookings(data: BulkCancelBookingsRequest): Promise<BulkCancelBookingsResponse> {
    return new Promise((resolve, reject) => {
      this.client.bulkCancelBookings(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  updateBookingAmount(data: UpdateBookingAmountRequest): Promise<UpdateBookingAmountResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateBookingAmount(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }
}
