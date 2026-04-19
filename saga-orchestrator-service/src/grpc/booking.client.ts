import { envConfig } from "../config/env.config";
import {
  createCircuitBreaker,
  createGrpcClient,
  executeUnaryGrpcCall,
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
  private readonly findBookingBreaker = createCircuitBreaker<[FindBookingRequest], FindBookingResponse>({
    name: "saga.booking.find_booking",
    timeoutMs: 5000,
    action: (data) => this.executeFindBooking(data),
  });
  private readonly updateBookingStatusBreaker = createCircuitBreaker<
    [UpdateBookingStatusRequest],
    UpdateBookingStatusResponse
  >({
    name: "saga.booking.update_status",
    timeoutMs: 5000,
    action: (data) => this.executeUpdateBookingStatus(data),
  });
  private readonly bulkCancelBookingsBreaker = createCircuitBreaker<
    [BulkCancelBookingsRequest],
    BulkCancelBookingsResponse
  >({
    name: "saga.booking.bulk_cancel",
    timeoutMs: 5000,
    action: (data) => this.executeBulkCancelBookings(data),
  });
  private readonly updateBookingAmountBreaker = createCircuitBreaker<
    [UpdateBookingAmountRequest],
    UpdateBookingAmountResponse
  >({
    name: "saga.booking.update_amount",
    timeoutMs: 5000,
    action: (data) => this.executeUpdateBookingAmount(data),
  });

  findBooking(data: FindBookingRequest): Promise<FindBookingResponse> {
    return this.findBookingBreaker.fire(data);
  }

  findBookingsByEvent(data: FindBookingsByEventRequest): Promise<FindBookingsByEventResponse> {
    return this.findBookingsByEventBreaker.fire(data);
  }

  private executeFindBookingsByEvent(
    data: FindBookingsByEventRequest,
  ): Promise<FindBookingsByEventResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.findBookingsByEvent(data, metadata, options, callback),
    });
  }

  updateBookingStatus(data: UpdateBookingStatusRequest): Promise<UpdateBookingStatusResponse> {
    return this.updateBookingStatusBreaker.fire(data);
  }

  bulkCancelBookings(data: BulkCancelBookingsRequest): Promise<BulkCancelBookingsResponse> {
    return this.bulkCancelBookingsBreaker.fire(data);
  }

  private executeBulkCancelBookings(
    data: BulkCancelBookingsRequest,
  ): Promise<BulkCancelBookingsResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.bulkCancelBookings(data, metadata, options, callback),
    });
  }

  updateBookingAmount(data: UpdateBookingAmountRequest): Promise<UpdateBookingAmountResponse> {
    return this.updateBookingAmountBreaker.fire(data);
  }

  private executeFindBooking(data: FindBookingRequest): Promise<FindBookingResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.findBooking(data, metadata, options, callback),
    });
  }

  private executeUpdateBookingStatus(
    data: UpdateBookingStatusRequest,
  ): Promise<UpdateBookingStatusResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.updateBookingStatus(data, metadata, options, callback),
    });
  }

  private executeUpdateBookingAmount(
    data: UpdateBookingAmountRequest,
  ): Promise<UpdateBookingAmountResponse> {
    return executeUnaryGrpcCall({
      timeoutMs: this.GRPC_TIMEOUT_MS,
      invoke: (metadata, options, callback) =>
        this.client.updateBookingAmount(data, metadata, options, callback),
    });
  }
}
