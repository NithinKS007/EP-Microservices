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
      seatStatus: "available" as const,
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
      if (event.status !== "active") {
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
}
