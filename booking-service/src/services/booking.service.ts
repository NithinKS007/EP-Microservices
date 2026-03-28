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

  async create({ eventId, seats, totalAmount, userId }: CreateBookingDto) {
    if (!eventId || !seats || !totalAmount || !userId || !seats.length)
      throw new ValidationError("Missing required fields");

    const booking = await this.bookingRepository.create({
      userId,
      eventId,
      status: "PENDING",
      totalAmount,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      bookingSeats: {
        createMany: {
          data: seats.map((s) => ({
            seatId: s.id,
            price: s.price,
          })),
        },
      },
    });

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

  async findBooking(bookingId: string) {
    if (!bookingId) throw new ValidationError("Missing required fields");
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError("Failed to find booking, Please try again later");
    return {
      ...booking,
      totalAmount: Number(booking.totalAmount),
    };
  }

  async findBookingsByEvent(eventId: string) {
    if (!eventId) throw new ValidationError("Missing required fields");
    const bookings = await this.bookingRepository.findBookingsByEventId(eventId);
    return bookings.map((booking) => ({
      ...booking,
      totalAmount: Number(booking.totalAmount),
    }));
  }
}
