import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  fromGrpcError,
  Metadata,
} from "../../../utils/src";
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
  private readonly GRPC_TIMEOUT_MS = 4000;
  private client = createGrpcClient(
    BookingServiceClient,
    envConfig.BOOKING_SERVICE_URL_GRPC || "booking:50053",
  );
  private readonly findBookingsByEventBreaker = createCircuitBreaker<
    [FindBookingsByEventRequest],
    FindBookingsByEventResponse
  >({
    name: "saga.booking.find_by_event",
    timeoutMs: 5000,
    action: (data) => this.executeFindBookingsByEvent(data),
  });
  private readonly bulkCancelBookingsBreaker = createCircuitBreaker<
    [BulkCancelBookingsRequest],
    BulkCancelBookingsResponse
  >({
    name: "saga.booking.bulk_cancel",
    timeoutMs: 5000,
    action: (data) => this.executeBulkCancelBookings(data),
  });

  findBooking(data: FindBookingRequest): Promise<FindBookingResponse> {
    return new Promise((resolve, reject) => {
      this.client.findBooking(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  findBookingsByEvent(data: FindBookingsByEventRequest): Promise<FindBookingsByEventResponse> {
    return this.findBookingsByEventBreaker.fire(data);
  }

  private executeFindBookingsByEvent(
    data: FindBookingsByEventRequest,
  ): Promise<FindBookingsByEventResponse> {
    return new Promise((resolve, reject) => {
      this.client.findBookingsByEvent(
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

  updateBookingStatus(data: UpdateBookingStatusRequest): Promise<UpdateBookingStatusResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateBookingStatus(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }

  bulkCancelBookings(data: BulkCancelBookingsRequest): Promise<BulkCancelBookingsResponse> {
    return this.bulkCancelBookingsBreaker.fire(data);
  }

  private executeBulkCancelBookings(
    data: BulkCancelBookingsRequest,
  ): Promise<BulkCancelBookingsResponse> {
    return new Promise((resolve, reject) => {
      this.client.bulkCancelBookings(
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

  updateBookingAmount(data: UpdateBookingAmountRequest): Promise<UpdateBookingAmountResponse> {
    return new Promise((resolve, reject) => {
      this.client.updateBookingAmount(data, (err, res) => {
        if (err) return reject(fromGrpcError(err));
        resolve(res);
      });
    });
  }
}
