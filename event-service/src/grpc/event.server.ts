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
  FindEventsByIdsWithSeatsRequest,
  FindEventsByIdsWithSeatsResponse,
  EventStatus,
  SeatStatus,
  SeatTier,
} from "../../../utils/src/index";
import { EventService } from "../services/event.service";

export class EventGrpcController {
  private readonly seatService: SeatService;
  private readonly eventService: EventService;
  constructor({
    seatService,
    eventService,
  }: {
    seatService: SeatService;
    eventService: EventService;
  }) {
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
      .then(() =>
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
      .then(() =>
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

  findEventsByIdsWithSeats(
    call: ServerUnaryCall<FindEventsByIdsWithSeatsRequest, FindEventsByIdsWithSeatsResponse>,
    callback: SendUnaryData<FindEventsByIdsWithSeatsResponse>,
  ) {
    const { eventIds, seatPage, seatLimit, seatIds } = call.request;
    this.eventService
      .findEventsByIdsWithSeats(eventIds, seatPage, seatLimit, seatIds)
      .then((events) =>
        callback(null, {
          success: true,
          message: "Events found successfully",
          events: events.map((event) => ({
            id: event.id,
            name: event.name,
            description: event.description || "",
            venueName: event.venueName,
            eventDate: event.eventDate,
            status: event.status === "CANCELLED" ? EventStatus.EVENT_STATUS_CANCELLED : EventStatus.EVENT_STATUS_ACTIVE,
            seats: event.seats.map((seat) => ({
              id: seat.id,
              eventId: seat.eventId,
              seatNumber: seat.seatNumber,
              seatTier: this.mapSeatTier(seat.seatTier),
              price: Number(seat.price),
              seatStatus: this.mapSeatStatus(seat.seatStatus),
              lockedByBookingId: seat.lockedByBookingId || "",
              lockExpiresAt: seat.lockExpiresAt || undefined,
              createdAt: seat.createdAt,
              updatedAt: seat.updatedAt,
            })),
            createdAt: event.createdAt,
            updatedAt: event.updatedAt,
          })),
        }),
      )
      .catch((err) => callback(toGrpcError(err), null));
  }

  private mapSeatStatus(status: "AVAILABLE" | "LOCKED" | "SOLD"): SeatStatus {
    switch (status) {
      case "LOCKED":
        return SeatStatus.SEAT_STATUS_LOCKED
      case "SOLD":
        return SeatStatus.SEAT_STATUS_SOLD;
      default:
        return SeatStatus.SEAT_STATUS_AVAILABLE;
    }
  }

  private mapSeatTier(tier: "VIP" | "REGULAR" | "ECONOMY"): SeatTier {
    switch (tier) {
      case "VIP":
        return SeatTier.SEAT_TIER_VIP
      case "REGULAR":
        return SeatTier.SEAT_TIER_REGULAR;
      default:
        return SeatTier.SEAT_TIER_ECONOMY;
    }
  }
}
