import { AuthReq, sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { Response } from "express";
import { EventService } from "./../services/event.service";
import { CreateEventDto, GetEventsQueryDto, UpdateEventDto } from "./../dtos/event.dtos";

export class EventController {
  private readonly eventService: EventService;

  constructor({ eventService }: { eventService: EventService }) {
    this.eventService = eventService;
  }

  async create(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(CreateEventDto, req.body);
    await this.eventService.createEvent(data);
    sendResponse(res, StatusCodes.Created, null, "Event created successfully");
  }

  async findEventsWithPagination(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(GetEventsQueryDto, req.query);
    const events = await this.eventService.findEventsWithPagination(data);
    sendResponse(res, StatusCodes.OK, events, "Events fetched successfully");
  }

  async findEventById(req: AuthReq, res: Response): Promise<void> {
    const { id } = req.params;
    const event = await this.eventService.findEventById(id);
    sendResponse(res, StatusCodes.OK, event, "Event fetched successfully");
  }

  async updateEvent(req: AuthReq, res: Response): Promise<void> {
    const { id } = req.params;
    const data = await validateDto(UpdateEventDto, req.body);
    await this.eventService.updateEvent(id, data);
    sendResponse(res, StatusCodes.OK, null, "Event updated successfully");
  }

  async deleteEvent(req: AuthReq, res: Response): Promise<void> {
    const { id } = req.params;
    await this.eventService.deleteEvent(id);
    sendResponse(res, StatusCodes.OK, null, "Event deleted successfully");
  }
}
