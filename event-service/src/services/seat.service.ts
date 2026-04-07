import { CreateSeatsDto, GetSeatsQueryDto } from "./../dtos/seat.dtos";
import { ISeatRepository } from "./../interface/ISeat.repository";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { IEventRepository } from "./../interface/IEvent.repository";
import { UnitOfWork } from "./../repositories/unity.of.work";

export class SeatService {
  private readonly seatRepository: ISeatRepository;
  private readonly eventRepository: IEventRepository;
  private readonly unitOfWork: UnitOfWork;
  constructor({
    seatRepository,
    eventRepository,
    unitOfWork,
  }: {
    seatRepository: ISeatRepository;
    eventRepository: IEventRepository;
    unitOfWork: UnitOfWork;
  }) {
    this.seatRepository = seatRepository;
    this.eventRepository = eventRepository;
    this.unitOfWork = unitOfWork;
  }

  /**
   * Creates seats for an active event.
   * Used in: Event seat setup flow
   * Triggered via: REST
   */
  async createSeats(data: CreateSeatsDto) {
    const { eventId, seats } = data;

    if (seats.length === 0) {
      throw new ValidationError("Seats are required, Please try again later");
    }

    const normalizedSeats = seats.map((seat) => ({
      eventId,
      seatNumber: seat.seatNumber.trim().toUpperCase(),
      seatTier: seat.seatTier,
      price: seat.price,
      seatStatus: "AVAILABLE" as const,
      lockExpiresAt: null,
    }));

    const seatNumbers = normalizedSeats.map((s) => s.seatNumber);

    const existingSeats = await this.seatRepository.findSeatNumbersByEvent(eventId, seatNumbers);

    if (existingSeats.length > 0) {
      throw new ValidationError(`Seats already exist: ${existingSeats.join(", ")}`);
    }

    const seen = new Set<string>();
    for (const seat of normalizedSeats) {
      if (seen.has(seat.seatNumber)) {
        throw new Error(`Duplicate seatNumber: ${seat.seatNumber}`);
      }
      seen.add(seat.seatNumber);
    }

    await this.unitOfWork.withTransaction(async (_tx) => {
      const event = await this.eventRepository.findById(eventId);
      if (!event) {
        throw new NotFoundError("Event not found, Please try again later");
      }
      if (event.status !== "ACTIVE") {
        throw new ValidationError("Event is not active, Please try again later");
      }
      return await this.seatRepository.bulkCreateSeats(normalizedSeats);
    });
  }

  /**
   * Lists seats for an event with pagination.
   * Used in: Event seat read flow
   * Triggered via: REST
   */
  async findSeatsWithPagination({ eventId, limit, page, seatStatus, seatTier }: GetSeatsQueryDto) {
    if (page < 1 || limit < 1) {
      throw new ValidationError("Invalid pagination parameters");
    }

    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }

    return await this.seatRepository.findSeatsWithPagination({
      eventId,
      limit,
      page,
      seatStatus,
      seatTier,
    });
  }

  /**
   * Locks all requested seats or fails the request without partial locks.
   * Used in: Booking Saga (Step: Seat Lock)
   * Triggered via: gRPC
   */
  async lockSeats({
    bookingId,
    eventId,
    expiresAt,
    seatIds,
  }: {
    bookingId: string;
    eventId: string;
    expiresAt?: Date;
    seatIds: string[];
  }) {
    const expiresAtDate = expiresAt || new Date(Date.now() + 20 * 60 * 1000);
    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError("Event not found, Please try again later");
    }
    if (event.status !== "ACTIVE") {
      throw new ValidationError("Event is not active, Please try again later");
    }

    const notAvailable = await this.seatRepository.findNotAvailableSeats(seatIds, eventId);

    if (notAvailable.length > 0) {
      const seats = notAvailable.map((s) => `${s.seatNumber} (${s.seatTier})`).join(", ");
      throw new ValidationError(
        `The following seats are already booked or temporarily unavailable: ${seats}. Please select different seats and try again.`,
      );
    }
    const lockedCount = await this.seatRepository.lockSeats(
      bookingId,
      eventId,
      expiresAtDate,
      seatIds,
    );
    if (lockedCount !== seatIds.length) {
      throw new ConflictError("Failed to lock all requested seats, Please try again later");
    }

    return;
  }

  /**
   * Confirms previously locked seats as sold.
   * Used in: Booking Saga (Step: Confirm Seats)
   * Triggered via: gRPC
   */
  async confirmSeats({ bookingId }: { bookingId: string }) {
    return await this.seatRepository.confirmSeats(bookingId);
  }

  /**
   * Releases locked seats for a booking.
   * Used in: Booking Saga compensation
   * Triggered via: gRPC
   */
  async releaseSeats({ bookingId }: { bookingId: string }) {
    return await this.seatRepository.releaseSeats(bookingId);
  }
}
