import { ISeatRepository } from "interface/ISeat.repository";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { CreateEventDto, GetEventsQueryDto, UpdateEventDto } from "./../dtos/event.dtos";
import { IEventRepository } from "./../interface/IEvent.repository";
import { UnitOfWork } from "./../repositories/unity.of.work";

export class EventService {
  private readonly eventRepository: IEventRepository;
  private readonly seatRepository: ISeatRepository;
  private readonly unitOfWork: UnitOfWork;
  constructor({
    eventRepository,
    seatRepository,
    unitOfWork,
  }: {
    eventRepository: IEventRepository;
    seatRepository: ISeatRepository;
    unitOfWork: UnitOfWork;
  }) {
    this.eventRepository = eventRepository;
    this.seatRepository = seatRepository;
    this.unitOfWork = unitOfWork;
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
      status: "active",
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
    const soldSeats = await this.seatRepository.count({
      eventId: id,
      seatStatus: "sold",
    });
    if (soldSeats > 0) {
      throw new ConflictError("Event with sold seats cannot be deleted. Cancel it instead.");
    }
    return await this.eventRepository.delete({ id });
  }

  async cancelEvent(id: string) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new NotFoundError("Event not found");
    }
    return this.eventRepository.update({ id }, { status: "cancelled" });
  }
}
