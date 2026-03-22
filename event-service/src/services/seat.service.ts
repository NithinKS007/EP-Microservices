import { CreateSeatsDto, GetSeatsQueryDto } from "./../dtos/seat.dtos";
import { ISeatRepository } from "./../interface/ISeat.repository";
import { NotFoundError, ValidationError } from "../../../utils/src/error.handling.middleware";
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

    await this.unitOfWork.withTransaction(async (tx) => {
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

    const notAvailable = await this.seatRepository.findMany({
      where: {
        id: { in: seatIds },
        eventId: eventId,
        seatStatus: { not: "AVAILABLE" },
      },
      select: { id: true },
    });

    if (notAvailable.length > 0) {
      const seats = notAvailable.map((s) => `${s.seatNumber} (${s.seatTier})`).join(", ");
      throw new ValidationError(
        `The following seats are already booked or temporarily unavailable: ${seats}. Please select different seats and try again.`,
      );
    }
    return await this.seatRepository.lockSeats(bookingId, eventId, expiresAtDate, seatIds);
  }

  async confirmSeats({ bookingId }: { bookingId: string }) {
    return await this.seatRepository.confirmSeats(bookingId);
  }

  async releaseSeats({ bookingId }: { bookingId: string }) {
    return await this.seatRepository.releaseSeats(bookingId);
  }
}
