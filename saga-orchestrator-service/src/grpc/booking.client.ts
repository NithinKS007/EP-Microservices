import { envConfig } from "../config/env.config";
import { createGrpcClient, fromGrpcError } from "../../../utils/src";
import {
  FindBookingRequest,
  FindBookingResponse,
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

  updateBookingStatus(data: UpdateBookingStatusRequest): Promise<UpdateBookingStatusResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateBookingStatus(data, (err, res) => {
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
