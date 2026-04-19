import { BookingService } from "../services/booking.service";
import {
  toGrpcError,
  FindBookingRequest,
  FindBookingResponse,
  FindBookingsByEventRequest,
  FindBookingsByEventResponse,
  BulkCancelBookingsRequest,
  BulkCancelBookingsResponse,
  UpdateBookingStatusRequest,
  UpdateBookingStatusResponse,
  UpdateBookingAmountRequest,
  UpdateBookingAmountResponse,
  BookingStatus as GrpcBookingStatus,
} from "../../../utils/src/index";
import { ServerUnaryCall, SendUnaryData } from "../../../utils/src/index";
import { BookingStatus as EntityBookingStatus } from "../generated/prisma/client";

export class BookingGrpcController {
  private readonly bookingService: BookingService;
  constructor({ bookingService }: { bookingService: BookingService }) {
    this.bookingService = bookingService;
  }

  findBooking(
    call: ServerUnaryCall<FindBookingRequest, FindBookingResponse>,
    callback: SendUnaryData<FindBookingResponse>,
  ): void {
    const { bookingId } = call.request;
    this.bookingService
      .findBooking(bookingId)
      .then((booking) =>
        callback(null, {
          success: true,
          message: "Booking found successfully",
          booking: {
            ...booking,
            seatIds: booking.seatIds || [],
            status: this.mapBookingStatusToGrpc(booking.status),
          },
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  findBookingsByEvent(
    call: ServerUnaryCall<FindBookingsByEventRequest, FindBookingsByEventResponse>,
    callback: SendUnaryData<FindBookingsByEventResponse>,
  ): void {
    const { eventId, page, limit } = call.request;
    this.bookingService
      .findBookingsByEvent(eventId, page, limit)
      .then((bookings) =>
        callback(null, {
          success: true,
          message: "Bookings found successfully",
          bookings: bookings.map((booking) => ({
            ...booking,
            seatIds: (booking as { seatIds?: string[] }).seatIds || [],
            status: this.mapBookingStatusToGrpc(booking.status),
          })),
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  bulkCancelBookings(
    call: ServerUnaryCall<BulkCancelBookingsRequest, BulkCancelBookingsResponse>,
    callback: SendUnaryData<BulkCancelBookingsResponse>,
  ): void {
    const { bookingIds } = call.request;
    this.bookingService
      .bulkCancelBookings(bookingIds)
      .then((result) =>
        callback(null, {
          success: true,
          message: "Bookings cancelled successfully",
          affectedCount: result.affectedCount,
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  updateBookingStatus(
    call: ServerUnaryCall<UpdateBookingStatusRequest, UpdateBookingStatusResponse>,
    callback: SendUnaryData<UpdateBookingStatusResponse>,
  ) {
    const { bookingId, status } = call.request;
    this.bookingService
      .updateBookingStatus(bookingId, this.mapGrpcStatusToEntity(status))
      .then(() =>
        callback(null, {
          success: true,
          message: "Booking status updated successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  updateBookingAmount(
    call: ServerUnaryCall<UpdateBookingAmountRequest, UpdateBookingAmountResponse>,
    callback: SendUnaryData<UpdateBookingAmountResponse>,
  ) {
    const { bookingId, totalAmount } = call.request;
    this.bookingService
      .updateBookingAmount(bookingId, totalAmount)
      .then(() =>
        callback(null, {
          success: true,
          message: "Booking amount updated successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  private mapBookingStatusToGrpc(status: EntityBookingStatus): GrpcBookingStatus {
    switch (status) {
      case EntityBookingStatus.PENDING:
        return GrpcBookingStatus.BOOKING_STATUS_PENDING;

      case EntityBookingStatus.PAYMENT_INITIATED:
        return GrpcBookingStatus.BOOKING_STATUS_INITIATED;

      case EntityBookingStatus.CONFIRMED:
        return GrpcBookingStatus.BOOKING_STATUS_CONFIRMED;

      case EntityBookingStatus.CANCELLED:
        return GrpcBookingStatus.BOOKING_STATUS_CANCELLED;

      case EntityBookingStatus.EXPIRED:
        return GrpcBookingStatus.BOOKING_STATUS_EXPIRED;

      default:
        return GrpcBookingStatus.BOOKING_STATUS_PENDING;
    }
  }

  private mapGrpcStatusToEntity(status: GrpcBookingStatus): EntityBookingStatus {
    switch (status) {
      case GrpcBookingStatus.BOOKING_STATUS_PENDING:
        return EntityBookingStatus.PENDING;

      case GrpcBookingStatus.BOOKING_STATUS_INITIATED:
        return EntityBookingStatus.PAYMENT_INITIATED;

      case GrpcBookingStatus.BOOKING_STATUS_CONFIRMED:
        return EntityBookingStatus.CONFIRMED;

      case GrpcBookingStatus.BOOKING_STATUS_CANCELLED:
        return EntityBookingStatus.CANCELLED;

      case GrpcBookingStatus.BOOKING_STATUS_EXPIRED:
        return EntityBookingStatus.EXPIRED;

      default:
        return EntityBookingStatus.PENDING;
    }
  }
}
