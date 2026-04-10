import { ISeatRepository } from "interface/ISeat.repository";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { CreateEventDto, GetEventsQueryDto, UpdateEventDto } from "./../dtos/event.dtos";
import { IEventRepository } from "./../interface/IEvent.repository";
import { UnitOfWork } from "./../repositories/unity.of.work";
import { BookingServiceGrpcClient } from "../grpc/booking.client";
import { PaymentServiceGrpcClient } from "../grpc/payment.client";
import { BookingStatus, PaymentStatus } from "../../../utils/src";
import { SagaServiceGrpcClient } from "../grpc/saga.client";

export class EventService {
  private readonly eventRepository: IEventRepository;
  private readonly seatRepository: ISeatRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly bookingServiceGrpcClient: BookingServiceGrpcClient;
  private readonly paymentServiceGrpcClient: PaymentServiceGrpcClient;
  private readonly sagaServiceGrpcClient: SagaServiceGrpcClient;
  constructor({
    eventRepository,
    seatRepository,
    unitOfWork,
    bookingServiceGrpcClient,
    paymentServiceGrpcClient,
    sagaServiceGrpcClient,
  }: {
    eventRepository: IEventRepository;
    seatRepository: ISeatRepository;
    unitOfWork: UnitOfWork;
    bookingServiceGrpcClient: BookingServiceGrpcClient;
    paymentServiceGrpcClient: PaymentServiceGrpcClient;
    sagaServiceGrpcClient: SagaServiceGrpcClient;
  }) {
    this.eventRepository = eventRepository;
    this.seatRepository = seatRepository;
    this.unitOfWork = unitOfWork;
    this.bookingServiceGrpcClient = bookingServiceGrpcClient;
    this.paymentServiceGrpcClient = paymentServiceGrpcClient;
    this.sagaServiceGrpcClient = sagaServiceGrpcClient;
  }

  /**
   * Creates a new event after uniqueness and date validation.
   * Used in: Event create flow
   * Triggered via: REST
   */
  async createEvent({ eventDate, name, venueName, description }: CreateEventDto) {
    if (eventDate <= new Date()) {
      throw new ValidationError("Event date must be in the future, Please try again later");
    }
    const existing = await this.eventRepository.findExisting(eventDate, venueName, name);
    if (existing) {
      throw new ConflictError("Event already exists for this date, Please try again later");
    }
    return await this.eventRepository.create({
      eventDate,
      name,
      venueName,
      description,
      status: "ACTIVE",
    });
  }

  /**
   * Returns paginated event data.
   * Used in: Event list flow
   * Triggered via: REST
   */
  async findEventsWithPagination({ limit, page }: GetEventsQueryDto) {
    return await this.eventRepository.findEventsWithPagination({ limit, page });
  }

  /**
   * Loads one event by id or throws when missing.
   * Used in: Event detail flow
   * Triggered via: REST
   */
  async findEventById(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }
    return event;
  }

  /**
   * Updates editable event fields after validation.
   * Used in: Event update flow
   * Triggered via: REST
   */
  async updateEvent(id: string, { eventDate, name, venueName }: UpdateEventDto) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }
    if (eventDate <= new Date()) {
      throw new ValidationError("Event date must be in the future");
    }
    const existing = await this.eventRepository.findExisting(eventDate, venueName, name, id);
    if (existing) {
      throw new ConflictError("Event already exists for this date, Please try again later");
    }
    await this.eventRepository.update({ id }, { eventDate, name, venueName });
  }

  /**
   * Deletes an event only when seats, bookings, and payments are already settled.
   * Used in: Event delete flow
   * Triggered via: REST
   */
  async deleteEvent(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }
    if (event.status !== "CANCELLED") {
      throw new ConflictError("Cancel the event before deleting it");
    }
    const [soldSeats, lockedSeats] = await Promise.all([
      this.seatRepository.countSoldSeats(id),
      this.seatRepository.countLockedSeats(id),
    ]);

    if (soldSeats > 0 || lockedSeats > 0) {
      throw new ConflictError(
        "Event with active seat allocations cannot be deleted, Please try again later",
      );
    }

    const bookingsResponse = await this.bookingServiceGrpcClient.findBookingsByEvent({
      eventId: id,
    });
    const bookings = bookingsResponse.bookings;
    const hasActiveBookings = bookings.some(
      (booking) =>
        booking.status !== BookingStatus.BOOKING_STATUS_CANCELLED &&
        booking.status !== BookingStatus.BOOKING_STATUS_EXPIRED,
    );

    if (hasActiveBookings) {
      throw new ConflictError("Event with active bookings cannot be deleted");
    }

    if (bookings.length > 0) {
      const paymentsResponse = await this.paymentServiceGrpcClient.findPaymentsByBookingIds({
        bookingIds: bookings.map((booking) => booking.id),
      });
      const hasUnsettledPayments = (paymentsResponse.payments || []).some(
        (payment) =>
          payment.status !== PaymentStatus.PAYMENT_STATUS_FAILED &&
          payment.status !== PaymentStatus.PAYMENT_STATUS_REFUNDED,
      );

      if (hasUnsettledPayments) {
        throw new ConflictError("Event with unsettled payments cannot be deleted");
      }
    }
    return await this.eventRepository.delete({ id });
  }

  /**
   * Starts the cancel-event saga after validating the event.
   * Used in: Cancel Event Saga start
   * Triggered via: REST
   */
  async cancelEvent(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }

    if (event.eventDate <= new Date() && event.status !== "CANCELLED") {
      throw new ValidationError("Event date must be in the future, Please try again later");
    }

    const saga = await this.sagaServiceGrpcClient.startCancelEventSaga({
      eventId: id,
    });

    return {
      eventId: id,
      sagaId: saga.sagaId,
      status: saga.status,
    };
  }

  /**
   * Releases seats for multiple bookings inside event-service inventory.
   * Used in: Cancel Event Saga (Step: Seat Release)
   * Triggered via: gRPC
   */
  async bulkReleaseSeatsForBookings(bookingIds: string[]) {
    if (!bookingIds.length) {
      return { affectedCount: 0 };
    }
    const affectedCount = await this.seatRepository.bulkReleaseSeatsForBookings(bookingIds);
    return { affectedCount };
  }

  /**
   * Marks the event as cancelled in the final persisted state.
   * Used in: Cancel Event Saga (Step: Event Status)
   * Triggered via: gRPC
   */
  async markEventCancelledFromSaga(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }
    if (event.status === "CANCELLED") {
      return event;
    }

    await this.eventRepository.update({ id }, { status: "CANCELLED" });
    return this.eventRepository.findById(id);
  }

  /**
   * Returns event records enriched with seat inventory for downstream reads.
   * Used in: Booking detail enrichment flow
   * Triggered via: gRPC
   */
  async findEventsByIdsWithSeats(eventIds: string[]) {
    if (!eventIds.length) {
      return [];
    }

    return await this.eventRepository.findEventsByIdsWithSeats(eventIds);
  }
}
