import { CreateBookingDto } from "./../dtos/booking.dtos";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { IBookingRepository } from "../interface/IBooking.repository";
import { IBookingSeatRepository } from "../interface/IBooking.seat.repository";
import { KafkaService } from "../../../utils/src";

export class BookingService {
  private readonly bookingRepository: IBookingRepository;
  private readonly bookingSeatRepository: IBookingSeatRepository;
  private readonly kafkaService: KafkaService;

  constructor({
    bookingRepository,
    bookingSeatRepository,
    kafkaService,
  }: {
    bookingRepository: IBookingRepository;
    bookingSeatRepository: IBookingSeatRepository;
    kafkaService: KafkaService;
  }) {
    this.bookingRepository = bookingRepository;
    this.bookingSeatRepository = bookingSeatRepository;
    this.kafkaService = kafkaService;
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
      booking = await this.bookingRepository.create({
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
    } catch (err) {
      if (idempotencyKey) {
        const existingBooking = await this.bookingRepository.findByIdempotencyKey(idempotencyKey);
        if (existingBooking) {
          return existingBooking;
        }
      }
      throw err;
    }

    await this.kafkaService.publishMessage({
      topic: "booking.created",
      message: {
        bookingId: booking.id,
        userId,
        eventId,
        seatIds: seats.map((s) => s.id),
      },
    });
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
    const booking = await this.bookingRepository.update({ id: bookingId }, { status });
    if (!booking)
      throw new NotFoundError("Failed to update booking status, Please try again later");
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
}
