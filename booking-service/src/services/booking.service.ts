import { CreateBookingDto, GetBookingsQueryDto } from "./../dtos/booking.dtos";
import { NotFoundError, ValidationError } from "../../../utils/src/error.handling.middleware";
import { IBookingRepository } from "../interface/IBooking.repository";
import { IBookingSeatRepository } from "../interface/IBooking.seat.repository";
import { UnitOfWork } from "../repositories/unity.of.work";
import { EventServiceGrpcClient } from "../grpc/event.client";
import { PaymentServiceGrpcClient } from "./../grpc/payment.client";
import { logger } from "../../../utils/src";

export class BookingService {
  private readonly bookingRepository: IBookingRepository;
  private readonly bookingSeatRepository: IBookingSeatRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly eventServiceGrpcClient: EventServiceGrpcClient;
  private readonly paymentServiceGrpcClient: PaymentServiceGrpcClient;

  constructor({
    bookingRepository,
    bookingSeatRepository,
    unitOfWork,
    eventServiceGrpcClient,
    paymentServiceGrpcClient,
  }: {
    bookingRepository: IBookingRepository;
    bookingSeatRepository: IBookingSeatRepository;
    unitOfWork: UnitOfWork;
    eventServiceGrpcClient: EventServiceGrpcClient;
    paymentServiceGrpcClient: PaymentServiceGrpcClient;
  }) {
    this.bookingRepository = bookingRepository;
    this.bookingSeatRepository = bookingSeatRepository;
    this.unitOfWork = unitOfWork;
    this.eventServiceGrpcClient = eventServiceGrpcClient;
    this.paymentServiceGrpcClient = paymentServiceGrpcClient;
  }

  /**
   * Creates a booking and publishes the booking-created event once.
   * Used in: Booking create flow
   * Triggered via: REST
   */
  async create({ eventId, seats, totalAmount, userId }: CreateBookingDto, idempotencyKey?: string) {
    if (
      !eventId ||
      !seats ||
      totalAmount === undefined ||
      totalAmount === null ||
      !userId ||
      !seats.length
    )
      throw new ValidationError("Missing required fields");

    if (idempotencyKey) {
      const existingBooking = await this.bookingRepository.findByIdempotencyKey(idempotencyKey);
      if (existingBooking) {
        return existingBooking;
      }
    }

    const booking = await this.unitOfWork.withTransaction(async (repos) => {
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
    if (!existing)
      throw new NotFoundError("Failed to update booking status, Please try again later");

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

  /**
   * Lists all bookings that belong to one user or one event.
   * Used in: Booking REST read flow
   * Triggered via: REST
   */
  async findBookingsWithPagination({ limit, page, eventId, userId }: GetBookingsQueryDto) {
    const bookings = await this.bookingRepository.findPaginatedBookingsWithSeats({
      limit,
      page,
      eventId,
      userId,
    });

    if (!bookings.data.length) {
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
        },
      };
    }

    const bookingIds = bookings.data.map((b) => b.id);
    const eventIds = [...new Set(bookings.data.map((b) => b.eventId))];

    const [eventDetails, paymentDetails] = await Promise.all([
      this.eventServiceGrpcClient.findEventsByIdsWithSeats({ eventIds }),
      this.paymentServiceGrpcClient.findPaymentsByBookingIds({ bookingIds }),
    ]);

    const eventMap = new Map(eventDetails.events?.map((e) => [e.id, e]) || []);
    const paymentMap = new Map(paymentDetails.payments?.map((p) => [p.bookingId, p]) || []);

    logger.info(`Event details: ${JSON.stringify(eventDetails)}`);
    logger.info(`Payment details: ${JSON.stringify(paymentDetails)}`);

    return bookings.data.map((booking) => {
      const event = eventMap.get(booking.eventId);
      const payment = paymentMap.get(booking.id);

      return {
        id: booking.id,
        status: booking.status,
        totalAmount: Number(booking.totalAmount),
        expiresAt: booking.expiresAt,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        event: {
          name: event?.name,
          eventDate: event?.eventDate,
          venueName: event?.venueName,
          description: event?.description,
          status: event?.status,
        },
        // Seat Enrichment (Map internal IDs to readable labels)
        BookedSeats:
          booking.bookingSeats?.map((bs) => {
            const seat = event?.seats?.find((s) => s.id === bs.seatId);
            return {
              id: bs.seatId,
              bookingId: bs.bookingId,
              price: Number(bs.price),
              createdAt: bs.createdAt,
              updatedAt: bs.updatedAt,
              seatDetails: {
                seatNumber: seat?.seatNumber,
                seatTier: seat?.seatTier,
                seatStatus: seat?.seatStatus,
              },
            };
          }) || [],
        // Payment Enrichment
        payment: {
          id: payment?.id,
          amount: Number(payment?.amount),
          currency: payment?.currency,
          status: payment?.status,
          provider: payment?.provider,
          providerRef: payment?.providerRef,
        },
      };
    });
  }

  async findBookingByIdWithDetails(id: string) {
    const booking = await this.bookingRepository.findBookingByIdWithSeats(id);

    if (!booking) {
      throw new NotFoundError("Booking not found, Please try again later");
    }

    const [eventDetails, paymentDetails] = await Promise.all([
      this.eventServiceGrpcClient.findEventsByIdsWithSeats({
        eventIds: [booking.eventId],
      }),
      this.paymentServiceGrpcClient.findPaymentsByBookingIds({
        bookingIds: [id],
      }),
    ]);

    logger.info(`Event details: ${JSON.stringify(eventDetails)}`);
    logger.info(`Payment details: ${JSON.stringify(paymentDetails)}`);

    const eventMap = new Map((eventDetails.events ?? []).map((e) => [e.id, e]));

    const paymentMap = new Map((paymentDetails.payments ?? []).map((p) => [p.bookingId, p]));

    const event = eventMap.get(booking.eventId);
    const payment = paymentMap.get(booking.id);

    return {
      id: booking.id,
      status: booking.status,
      totalAmount: Number(booking.totalAmount),
      expiresAt: booking.expiresAt,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,

      event: {
        name: event?.name,
        eventDate: event?.eventDate,
        venueName: event?.venueName,
        description: event?.description,
        status: event?.status,
      },

      bookedSeats:
        booking.bookingSeats?.map((bs) => {
          const seat = event?.seats?.find((s) => s.id === bs.seatId);

          return {
            id: bs.seatId,
            bookingId: bs.bookingId,
            price: Number(bs.price),
            createdAt: bs.createdAt,
            updatedAt: bs.updatedAt,

            seatDetails: {
              seatNumber: seat?.seatNumber,
              seatTier: seat?.seatTier,
              seatStatus: seat?.seatStatus,
            },
          };
        }) || [],

      payment: {
        id: payment?.id,
        amount: payment?.amount ? Number(payment.amount) : 0,
        currency: payment?.currency,
        status: payment?.status,
        provider: payment?.provider,
        providerRef: payment?.providerRef,
      },
    };
  }
}
