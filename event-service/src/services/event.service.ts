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

export class EventService {
  private readonly eventRepository: IEventRepository;
  private readonly seatRepository: ISeatRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly bookingServiceGrpcClient: BookingServiceGrpcClient;
  private readonly paymentServiceGrpcClient: PaymentServiceGrpcClient;
  constructor({
    eventRepository,
    seatRepository,
    unitOfWork,
    bookingServiceGrpcClient,
    paymentServiceGrpcClient,
  }: {
    eventRepository: IEventRepository;
    seatRepository: ISeatRepository;
    unitOfWork: UnitOfWork;
    bookingServiceGrpcClient: BookingServiceGrpcClient;
    paymentServiceGrpcClient: PaymentServiceGrpcClient;
  }) {
    this.eventRepository = eventRepository;
    this.seatRepository = seatRepository;
    this.unitOfWork = unitOfWork;
    this.bookingServiceGrpcClient = bookingServiceGrpcClient;
    this.paymentServiceGrpcClient = paymentServiceGrpcClient;
  }

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

  async findEventsWithPagination({ limit, page }: GetEventsQueryDto) {
    return await this.eventRepository.findEventsWithPagination({ limit, page });
  }

  async findEventById(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }
    return event;
  }

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

  async cancelEvent(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }

    if (event.status === "CANCELLED") {
      return event;
    }

    if (event.eventDate <= new Date()) {
      throw new ValidationError("Event date must be in the future, Please try again later");
    }

    const bookingsResponse = await this.bookingServiceGrpcClient.findBookingsByEvent({
      eventId: id,
    });

    const { bookings } = bookingsResponse;

    if (bookings.length === 0) {
      await this.eventRepository.update({ id }, { status: "CANCELLED" });
      return this.eventRepository.findById(id); // SENDING LATEST EVENT
    }

    const paymentsResponse = await this.paymentServiceGrpcClient.findPaymentsByBookingIds({
      bookingIds: bookings.map((booking) => booking.id),
    });

    const { payments } = paymentsResponse;

    const paymentsByBookingId = new Map<string, (typeof payments)[number][]>();
    for (const payment of payments || []) {
      const existingPayments = paymentsByBookingId.get(payment.bookingId) || [];
      existingPayments.push(payment);
      paymentsByBookingId.set(payment.bookingId, existingPayments);
    }

    for (const booking of bookings) {
      const relatedPayments = paymentsByBookingId.get(booking.id) || [];

      for (const payment of relatedPayments) {
        if (payment.status === PaymentStatus.PAYMENT_STATUS_SUCCESS) {
          await this.paymentServiceGrpcClient.updatePaymentStatus({
            paymentId: payment.id,
            status: PaymentStatus.PAYMENT_STATUS_REFUNDED,
          });
        } else if (payment.status === PaymentStatus.PAYMENT_STATUS_INITIATED) {
          await this.paymentServiceGrpcClient.updatePaymentStatus({
            paymentId: payment.id,
            status: PaymentStatus.PAYMENT_STATUS_FAILED,
          });
        }
      }

      if (
        booking.status !== BookingStatus.BOOKING_STATUS_CANCELLED &&
        booking.status !== BookingStatus.BOOKING_STATUS_EXPIRED
      ) {
        await this.bookingServiceGrpcClient.updateBookingStatus({
          bookingId: booking.id,
          status: BookingStatus.BOOKING_STATUS_CANCELLED,
        });
      }

      await this.seatRepository.resetSeatsForBooking(booking.id);
    }

    await this.eventRepository.update({ id }, { status: "CANCELLED" });
    return this.eventRepository.findById(id);
  }
}
