import { ISeatRepository } from "./../interface/ISeat.repository";
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
import { BookingStatus, logger, PaymentStatus, RedisService } from "../../../utils/src";
import { SagaServiceGrpcClient } from "../grpc/saga.client";
import { envConfig } from "../config/env.config";

export class EventService {
  private readonly eventRepository: IEventRepository;
  private readonly seatRepository: ISeatRepository;
  private readonly unitOfWork: UnitOfWork;
  private readonly bookingServiceGrpcClient: BookingServiceGrpcClient;
  private readonly paymentServiceGrpcClient: PaymentServiceGrpcClient;
  private readonly sagaServiceGrpcClient: SagaServiceGrpcClient;
  private readonly redisService: RedisService;
  constructor({
    eventRepository,
    seatRepository,
    unitOfWork,
    bookingServiceGrpcClient,
    paymentServiceGrpcClient,
    sagaServiceGrpcClient,
    redisService,
  }: {
    eventRepository: IEventRepository;
    seatRepository: ISeatRepository;
    unitOfWork: UnitOfWork;
    bookingServiceGrpcClient: BookingServiceGrpcClient;
    paymentServiceGrpcClient: PaymentServiceGrpcClient;
    sagaServiceGrpcClient: SagaServiceGrpcClient;
    redisService: RedisService;
  }) {
    this.eventRepository = eventRepository;
    this.seatRepository = seatRepository;
    this.unitOfWork = unitOfWork;
    this.bookingServiceGrpcClient = bookingServiceGrpcClient;
    this.paymentServiceGrpcClient = paymentServiceGrpcClient;
    this.sagaServiceGrpcClient = sagaServiceGrpcClient;
    this.redisService = redisService;
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
   * Uses cache-aside pattern for metadata (60s TTL).
   * Used in: Event detail flow
   * Triggered via: REST
   */
  async findEventById(id: string) {
    // Try cache first
    const cached = await this.findEventFromCache(id);
    if (cached) {
      return cached;
    }

    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }

    // Warm cache
    await this.setEventInCache(id, event);

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
    await this.invalidateEventCache(id);
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

    const state = {
      page: 1,
      limit: 500,
      hasMore: true,
      hasActiveBookings: false,
      hasUnsettledPayments: false,
    };

    while (state.hasMore) {
      const bookingsResponse = await this.bookingServiceGrpcClient.findBookingsByEvent({
        eventId: id,
        page: state.page,
        limit: state.limit,
      });
      const batch = bookingsResponse.bookings || [];

      if (batch.length === 0) {
        state.hasMore = false;
        break;
      }

      const activeInBatch = batch.some(
        (booking) =>
          booking.status !== BookingStatus.BOOKING_STATUS_CANCELLED &&
          booking.status !== BookingStatus.BOOKING_STATUS_EXPIRED,
      );

      if (activeInBatch) {
        state.hasActiveBookings = true;
        break;
      }

      // We only lookup payments if we need to verify them, mapping IDs of the batch.
      const paymentBatchResponse = await this.paymentServiceGrpcClient.findPaymentsByBookingIds({
        bookingIds: batch.map((booking) => booking.id),
      });

      const unsettledInBatch = (paymentBatchResponse.payments || []).some(
        (payment) =>
          payment.status !== PaymentStatus.PAYMENT_STATUS_FAILED &&
          payment.status !== PaymentStatus.PAYMENT_STATUS_REFUNDED,
      );

      if (unsettledInBatch) {
        state.hasUnsettledPayments = true;
        break;
      }

      state.page++;
    }

    if (state.hasActiveBookings) {
      throw new ConflictError("Event with active bookings cannot be deleted");
    }

    if (state.hasUnsettledPayments) {
      throw new ConflictError("Event with unsettled payments cannot be deleted");
    }
    const deleted = await this.eventRepository.delete({ id });
    await this.invalidateEventCache(id);
    return deleted;
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
    await this.invalidateEventCache(id);
    return this.eventRepository.findById(id);
  }

  // ─── Event Metadata Cache Helpers ────────────────────────────────

  private eventCacheKey(id: string): string {
    return `${envConfig.EVENT_CACHE_PREFIX}:${id}`;
  }

  /**
   * Reads event metadata from Redis cache.
   * Returns null on miss or Redis error (optional cache — never blocks reads).
   */
  private async findEventFromCache(id: string) {
    if (!this.redisService.isConnected()) return null;

    try {
      const raw = await this.redisService.get(this.eventCacheKey(id));
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      logger.debug(`Cache HIT for event ${id}`);
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Writes event metadata to Redis with a short TTL.
   * Fire-and-forget — cache write failure never blocks the response.
   */
  private async setEventInCache(id: string, event: unknown): Promise<void> {
    if (!this.redisService.isConnected()) return;

    try {
      await this.redisService.set(
        this.eventCacheKey(id),
        JSON.stringify(event),
        envConfig.EVENT_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      logger.warn(`Failed to cache event ${id}: ${err}`);
    }
  }

  /**
   * Removes stale event metadata from cache after any mutation.
   * Fire-and-forget — invalidation failure is non-critical (TTL will clean up).
   */
  private async invalidateEventCache(id: string): Promise<void> {
    if (!this.redisService.isConnected()) return;

    try {
      await this.redisService.del(this.eventCacheKey(id));
      logger.debug(`Cache invalidated for event ${id}`);
    } catch (err) {
      logger.warn(`Failed to invalidate cache for event ${id}: ${err}`);
    }
  }

  /**
   * Returns event records enriched with seat inventory for downstream reads.
   * Used in: Booking detail enrichment flow
   * Triggered via: gRPC
   */
  async findEventsByIdsWithSeats(
    eventIds: string[],
    page?: number,
    limit?: number,
    seatIds?: string[],
  ) {
    if (!eventIds.length) {
      return [];
    }

    return await this.eventRepository.findEventsByIdsWithSeats(eventIds, page, limit, seatIds);
  }
}
