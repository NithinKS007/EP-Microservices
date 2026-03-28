import { SeatService } from "./../services/seat.service";
import { toGrpcError } from "../../../utils/src/index";
import { ServerUnaryCall, SendUnaryData } from "../../../utils/src/index";
import {
  LockSeatsRequest,
  LockSeatsResponse,
  ConfirmSeatsRequest,
  ConfirmSeatsResponse,
  ReleaseSeatsRequest,
  ReleaseSeatsResponse,
  BulkReleaseSeatsRequest,
  BulkReleaseSeatsResponse,
  MarkEventCancelledRequest,
  MarkEventCancelledResponse,
} from "../../../utils/src/index";
import { EventService } from "../services/event.service";

export class EventGrpcController {
  private readonly seatService: SeatService;
  private readonly eventService: EventService;
  constructor({ seatService, eventService }: { seatService: SeatService; eventService: EventService }) {
    this.seatService = seatService;
    this.eventService = eventService;
  }

  lockSeats(
    call: ServerUnaryCall<LockSeatsRequest, LockSeatsResponse>,
    callback: SendUnaryData<LockSeatsResponse>,
  ): void {
    const { bookingId, eventId, expiresAt, seatIds } = call.request;
    this.seatService
      .lockSeats({
        bookingId,
        eventId,
        expiresAt,
        seatIds,
      })
      .then(() => callback(null, { success: true, message: "Seats locked successfully" }))
      .catch((err) => callback(toGrpcError(err), null));
  }

  confirmSeats(
    call: ServerUnaryCall<ConfirmSeatsRequest, ConfirmSeatsResponse>,
    callback: SendUnaryData<ConfirmSeatsResponse>,
  ) {
    const { bookingId } = call.request;
    this.seatService
      .confirmSeats({ bookingId })
      .then((user) =>
        callback(null, {
          success: true,
          message: "Seats confirmed successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  releaseSeats(
    call: ServerUnaryCall<ReleaseSeatsRequest, ReleaseSeatsResponse>,
    callback: SendUnaryData<ReleaseSeatsResponse>,
  ) {
    const { bookingId } = call.request;
    this.seatService
      .releaseSeats({ bookingId })
      .then((user) =>
        callback(null, {
          success: true,
          message: "Seats released successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  bulkReleaseSeats(
    call: ServerUnaryCall<BulkReleaseSeatsRequest, BulkReleaseSeatsResponse>,
    callback: SendUnaryData<BulkReleaseSeatsResponse>,
  ) {
    const { bookingIds } = call.request;
    this.eventService
      .bulkReleaseSeatsForBookings(bookingIds)
      .then((result) =>
        callback(null, {
          success: true,
          message: "Seats released successfully",
          affectedCount: result.affectedCount,
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  markEventCancelled(
    call: ServerUnaryCall<MarkEventCancelledRequest, MarkEventCancelledResponse>,
    callback: SendUnaryData<MarkEventCancelledResponse>,
  ) {
    const { eventId } = call.request;
    this.eventService
      .markEventCancelledFromSaga(eventId)
      .then(() =>
        callback(null, {
          success: true,
          message: "Event marked as cancelled successfully",
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }
}
