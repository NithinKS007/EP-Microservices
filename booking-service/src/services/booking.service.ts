import { CreateBookingDto, GetBookingsQueryDto } from "./../dtos/booking.dtos";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { IBookingRepository } from "../interface/IBooking.repository";
import { IBookingSeatRepository } from "../interface/IBooking.seat.repository";
import { UnitOfWork } from "../repositories/unity.of.work";
import { EventServiceGrpcClient } from "../grpc/event.client";
import { PaymentServiceGrpcClient } from "./../grpc/payment.client";
import {
  AuthReq,
  logger,
  PaymentStatus,
  EventStatus,
  SeatStatus,
  SeatTier,
} from "../../../utils/src";

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

    const seatIds = seats.map((s) => s.id);

    // Snapshot seat details from Event Service
    const eventDetails = await this.eventServiceGrpcClient.findEventsByIdsWithSeats({
      eventIds: [eventId],
    });
    const event = eventDetails.events?.find((e) => e.id === eventId);
    if (!event) throw new NotFoundError("Event not found");

    const seatMap = new Map(event.seats?.map((s) => [s.id, s]) || []);

    const booking = await this.unitOfWork.withTransaction(async (repos) => {
      // 1. Acquire distributed transaction-level locks to prevent TOCTOU race conditions globally
      await repos.bookingRepository.acquireAdvisoryLocks(seatIds);

      // 2. Perform application-level seat conflict check INSIDE the locked critical section
      const conflictingSeats = await repos.bookingRepository.findActiveBookingsBySeatIds(seatIds);
      if (conflictingSeats.length > 0) {
        const conflictDetails = conflictingSeats
          .map((c) => `seat ${c.seatId} (booking ${c.bookingId}, status ${c.status})`)
          .join(", ");
        throw new ConflictError(`The following seats are already unavailable: ${conflictDetails}`);
      }

      // 3. Persist the booking and its seats
      const createdBooking = await repos.bookingRepository.create({
        userId,
        eventId,
        status: "PENDING",
        totalAmount,
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        idempotencyKey,
        bookingSeats: {
          createMany: {
            data: seats.map((s) => {
              const seatSnapshot = seatMap.get(s.id);
              return {
                seatId: s.id,
                price: s.price,
                seatNumber: seatSnapshot?.seatNumber || "N/A",
                seatTier: this.mapSeatTier(seatSnapshot?.seatTier),
              };
            }),
          },
        },
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
    const booking = await this.bookingRepository.findBookingByIdWithSeats(bookingId);
    if (!booking) throw new NotFoundError("Failed to find booking, Please try again later");
    return {
      ...booking,
      totalAmount: Number(booking.totalAmount),
      seatIds: booking.bookingSeats?.map((seat) => seat.seatId) || [],
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
          status: this.mapEventStatus(event?.status),
        },
        // Seat Enrichment (Map internal IDs to readable labels)
        BookedSeats:
          booking.bookingSeats?.map((bs) => {
            return {
              id: bs.seatId,
              bookingId: bs.bookingId,
              price: Number(bs.price),
              createdAt: bs.createdAt,
              updatedAt: bs.updatedAt,
              seatDetails: {
                seatNumber: bs.seatNumber,
                seatTier: bs.seatTier
              },
            };
          }) || [],
        // Payment Enrichment
        payment: {
          id: payment?.id,
          amount: Number(payment?.amount),
          currency: payment?.currency,
          status: this.mapPaymentStatus(payment?.status),
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
        status: this.mapEventStatus(event?.status),
      },

      bookedSeats:
        booking.bookingSeats?.map((bs) => {
          return {
            id: bs.seatId,
            bookingId: bs.bookingId,
            price: Number(bs.price),
            createdAt: bs.createdAt,
            updatedAt: bs.updatedAt,

            seatDetails: {
              seatNumber: bs.seatNumber,
              seatTier: bs.seatTier
            },
          };
        }) || [],

      payment: {
        id: payment?.id,
        amount: payment?.amount ? Number(payment.amount) : 0,
        currency: payment?.currency,
        status: this.mapPaymentStatus(payment?.status),
        provider: payment?.provider,
        providerRef: payment?.providerRef,
      },
    };
  }

  /**
   * Confirms a booking only after a successful payment is already recorded.
   * Used in: Booking manual recovery flow
   * Triggered via: REST
   */
  async confirmBooking(id: string, actor?: AuthReq["user"]) {
    const booking = await this.findBookingForAction(id, actor);

    if (booking.status === "CONFIRMED") {
      return await this.findBookingByIdWithDetails(id);
    }

    if ( ["CANCELLED","EXPIRED"].includes(booking.status)) {
      throw new ConflictError("Booking is already cancelled or expired,Please try again later");
    }

    const payment = await this.findSinglePaymentByBookingId(id);
    if (!payment || payment.status !== PaymentStatus.PAYMENT_STATUS_SUCCESS) {
      throw new ConflictError("Only successfully paid bookings can be confirmed,Please try again later");
    }

    await this.eventServiceGrpcClient.confirmSeats({ bookingId: id });
    await this.bookingRepository.update({ id }, { status: "CONFIRMED" });

    return await this.findBookingByIdWithDetails(id);
  }

  /**
   * Cancels a booking and releases any seats still associated with it.
   * Used in: Booking cancellation flow
   * Triggered via: REST
   */
  async cancelBooking(id: string, actor?: AuthReq["user"]) {
    const booking = await this.findBookingForAction(id, actor);

    if (booking.status === "CANCELLED") {
      return await this.findBookingByIdWithDetails(id);
    }

    if (booking.status === "EXPIRED") {
      throw new ConflictError("Expired bookings cannot be cancelled,Please try again later");
    }

    const payment = await this.findSinglePaymentByBookingId(id);
    if (
      booking.status === "CONFIRMED" &&
      payment?.status === PaymentStatus.PAYMENT_STATUS_SUCCESS
    ) {
      await this.paymentServiceGrpcClient.bulkRefundPayments({ bookingIds: [id] });
    }

    await this.eventServiceGrpcClient.bulkReleaseSeats({ bookingIds: [id] });

    // Fail any INITIATED payment when cancelling a non-confirmed booking
    if (["PENDING","PAYMENT_INITIATED"].includes(booking.status) ) {
      await this.paymentServiceGrpcClient.bulkFailPayments({ bookingIds: [id] });
    }

    await this.bookingRepository.update({ id }, { status: "CANCELLED" });

    return await this.findBookingByIdWithDetails(id);
  }

  /**
   * Expires an open booking immediately and releases its seats.
   * Used in: Booking forced-expiry flow
   * Triggered via: REST
   */
  async expireBooking(id: string, actor?: AuthReq["user"]) {
    const booking = await this.findBookingForAction(id, actor);

    if (booking.status === "EXPIRED") {
      return await this.findBookingByIdWithDetails(id);
    }

    if (["CANCELLED","CONFIRMED"].includes(booking.status)) {
      throw new ConflictError("Only open bookings can be expired, Please try again later");
    }

    const payment = await this.findSinglePaymentByBookingId(id);
    if (payment?.status === PaymentStatus.PAYMENT_STATUS_SUCCESS) {
      throw new ConflictError("Paid bookings cannot be expired, Please try again later");
    }

    await this.eventServiceGrpcClient.bulkReleaseSeats({ bookingIds: [id] });
    await this.paymentServiceGrpcClient.bulkFailPayments({ bookingIds: [id] });
    await this.bookingRepository.update({ id }, { status: "EXPIRED" });

    return await this.findBookingByIdWithDetails(id);
  }

  private async findBookingForAction(id: string, actor?: AuthReq["user"]) {
    if (!id) {
      throw new ValidationError("Booking id is required");
    }

    const booking = await this.bookingRepository.findBookingByIdWithSeats(id);
    if (!booking) {
      throw new NotFoundError("Booking not found, Please try again later");
    }

    if (actor?.role !== "ADMIN" && actor?.id !== booking.userId) {
      throw new ForbiddenError("You are not allowed to access this booking");
    }

    return booking;
  }

  private async findSinglePaymentByBookingId(bookingId: string) {
    const paymentsResponse = await this.paymentServiceGrpcClient.findPaymentsByBookingIds({
      bookingIds: [bookingId],
    });
    const payments = paymentsResponse.payments ?? [];
    return payments[payments.length - 1];
  }

  private mapEventStatus(status: number | undefined): string {
    switch (status) {
      case EventStatus.EVENT_STATUS_ACTIVE:
        return "ACTIVE";
      case EventStatus.EVENT_STATUS_CANCELLED:
        return "CANCELLED";
      default:
        return "UNSPECIFIED";
    }
  }

  private mapSeatTier(tier: number | undefined): string {
    switch (tier) {
      case SeatTier.SEAT_TIER_VIP:
        return "VIP";
      case SeatTier.SEAT_TIER_REGULAR:
        return "REGULAR";
      case SeatTier.SEAT_TIER_ECONOMY:
        return "ECONOMY";
      default:
        return "UNSPECIFIED";
    }
  }

  private mapSeatStatus(status: number | undefined): string {
    switch (status) {
      case SeatStatus.SEAT_STATUS_AVAILABLE:
        return "AVAILABLE";
      case SeatStatus.SEAT_STATUS_LOCKED:
        return "LOCKED";
      case SeatStatus.SEAT_STATUS_SOLD:
        return "SOLD";
      default:
        return "UNSPECIFIED";
    }
  }

  private mapPaymentStatus(status: number | undefined): string {
    switch (status) {
      case PaymentStatus.PAYMENT_STATUS_INITIATED:
        return "INITIATED";
      case PaymentStatus.PAYMENT_STATUS_SUCCESS:
        return "SUCCESS";
      case PaymentStatus.PAYMENT_STATUS_FAILED:
        return "FAILED";
      case PaymentStatus.PAYMENT_STATUS_REFUNDED:
        return "REFUNDED";
      default:
        return "UNSPECIFIED";
    }
  }
}
