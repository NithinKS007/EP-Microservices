import { CreateBookingDto } from "./../dtos/booking.dtos";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { IBookingRepository } from "../interface/IBooking.repository";
import { IBookingSeatRepository } from "../interface/IBooking.seat.repository";
import { UnitOfWork } from "../repositories/unity.of.work";
import { EventServiceGrpcClient } from "../grpc/event.client";

export class BookingService {
  private readonly bookingRepository: IBookingRepository;
  private readonly bookingSeatRepository: IBookingSeatRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly eventServiceGrpcClient: EventServiceGrpcClient;

  constructor({
    bookingRepository,
    bookingSeatRepository,
    unitOfWork,
    eventServiceGrpcClient,
  }: {
    bookingRepository: IBookingRepository;
    bookingSeatRepository: IBookingSeatRepository;
    unitOfWork: UnitOfWork;
    eventServiceGrpcClient: EventServiceGrpcClient;
  }) {
    this.bookingRepository = bookingRepository;
    this.bookingSeatRepository = bookingSeatRepository;
    this.unitOfWork = unitOfWork;
    this.eventServiceGrpcClient = eventServiceGrpcClient;
  }

  /**
   * Creates a booking and publishes the booking-created event once.
   * Used in: Booking create flow
   * Triggered via: REST
   */
  async create(
    { eventId, seats, totalAmount, userId }: CreateBookingDto,
    idempotencyKey?: string,
  ) {
    if (!eventId || !seats || totalAmount === undefined || totalAmount === null || !userId || !seats.length)
      throw new ValidationError("Missing required fields");

    if (idempotencyKey) {
      const existingBooking = await this.bookingRepository.findByIdempotencyKey(idempotencyKey);
      if (existingBooking) {
        return existingBooking;
      }
    }

    let booking;

    try {
      booking = await this.unitOfWork.withTransaction(async (repos) => {
        const createdBooking = await repos.bookingRepository.create({
          userId,
          eventId,
          status: "PENDING",
          totalAmount,
          expiresAt: new Date(Date.now() + 20 * 60 * 1000),
          idempotencyKey,
          bookingSeats: {
            createMany: {
              data: seats.map((s) => ({
                seatId: s.id,
                price: s.price,
              })),
            },
          },
        });

        await repos.outboxEventRepository.create({
          topic: "booking.created",
          payload: {
            bookingId: createdBooking.id,
            userId,
            eventId,
            totalAmount,
            expiresAt: createdBooking.expiresAt,
            seatIds: seats.map((s) => s.id),
          },
          status: "PENDING",
        });

        return createdBooking;
      });
    } catch (err) {
      if (idempotencyKey) {
        const existingBooking = await this.bookingRepository.findByIdempotencyKey(idempotencyKey);
        if (existingBooking) {
          return existingBooking;
        }
      }
      throw err;
    }

    return booking;
  }

  /**
   * Updates the stored total amount for a booking.
   * Used in: Booking internal sync flow
   * Triggered via: gRPC
   */
  async updateBookingAmount(bookingId: string, amount: number) {
    if (!bookingId || !amount) throw new ValidationError("Missing required fields");
    const booking = await this.bookingRepository.update({ id: bookingId }, { totalAmount: amount });
    if (!booking)
      throw new NotFoundError("Failed to update booking amount, Please try again later");
    return {
      ...booking,
      totalAmount: Number(booking.totalAmount),
    };
  }

  /**
   * Updates a booking lifecycle status.
   * Used in: Booking Saga / Cancel Event Saga
   * Triggered via: gRPC
   */
  async updateBookingStatus(
    bookingId: string,
    status: "PENDING" | "PAYMENT_INITIATED" | "CONFIRMED" | "CANCELLED" | "EXPIRED",
  ) {
    if (!bookingId || !status) throw new ValidationError("Missing required fields");
    const existing = await this.bookingRepository.findById(bookingId);
    if (!existing) throw new NotFoundError("Failed to update booking status, Please try again later");

    if (existing.status === status) {
      return {
        ...existing,
        totalAmount: Number(existing.totalAmount),
      };
    }

    if (
      existing.status === "CONFIRMED" ||
      existing.status === "CANCELLED" ||
      existing.status === "EXPIRED"
    ) {
      return {
        ...existing,
        totalAmount: Number(existing.totalAmount),
      };
    }

    const booking = await this.bookingRepository.update({ id: bookingId }, { status });
    if (!booking) throw new NotFoundError("Failed to update booking status, Please try again later");
    return {
      ...booking,
      totalAmount: Number(booking.totalAmount),
    };
  }

  /**
   * Finds a single booking by id.
   * Used in: Internal booking lookup flow
   * Triggered via: gRPC
   */
  async findBooking(bookingId: string) {
    if (!bookingId) throw new ValidationError("Missing required fields");
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError("Failed to find booking, Please try again later");
    return {
      ...booking,
      totalAmount: Number(booking.totalAmount),
    };
  }

  /**
   * Lists all bookings that belong to one event.
   * Used in: Cancel Event Saga
   * Triggered via: gRPC
   */
  async findBookingsByEvent(eventId: string) {
    if (!eventId) throw new ValidationError("Missing required fields");
    const bookings = await this.bookingRepository.findBookingsByEventId(eventId);
    return bookings.map((booking) => ({
      ...booking,
      totalAmount: Number(booking.totalAmount),
    }));
  }

  /**
   * Cancels multiple bookings while skipping already terminal ones.
   * Used in: Cancel Event Saga (Step: Booking Service)
   * Triggered via: gRPC
   */
  async bulkCancelBookings(bookingIds: string[]) {
    if (!bookingIds.length) {
      return { affectedCount: 0 };
    }

    const affectedCount = await this.bookingRepository.bulkCancelBookings(bookingIds);
    return { affectedCount };
  }

  /**
   * Expires stale open bookings and releases their locked seats.
   * Used in: Booking expiry cleanup flow
   * Triggered via: Cron job
   */
  async expirePendingBookings() {
    const expiredBookings = await this.bookingRepository.findExpiredPendingBookings();
    if (!expiredBookings.length) {
      return { affectedCount: 0 };
    }

    const bookingIds = expiredBookings.map((booking) => booking.id);

    await this.eventServiceGrpcClient.bulkReleaseSeats({ bookingIds });
    const affectedCount = await this.bookingRepository.bulkExpireBookings(bookingIds);

    return { affectedCount };
  }
}
