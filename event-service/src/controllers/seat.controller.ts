import { AuthReq, sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { Response } from "express";
import { SeatService } from "./../services/seat.service";
import { CreateSeatsDto, GetSeatsQueryDto, LockSeatDto } from "./../dtos/seat.dtos";

export class SeatController {
  private readonly seatService: SeatService;

  constructor({ seatService }: { seatService: SeatService }) {
    this.seatService = seatService;
  }

  async create(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(CreateSeatsDto, { ...req.body, eventId: req.params.eventId });
    await this.seatService.createSeats(data);
    sendResponse(res, StatusCodes.Created, null, "Seats created successfully");
  }

  async findSeatsWithPagination(req: AuthReq, res: Response) {
    const data = await validateDto(GetSeatsQueryDto, { ...req.query, eventId: req.params.eventId });
    const result = await this.seatService.findSeatsWithPagination(data);
    sendResponse(res, StatusCodes.OK, result, "Seats fetched successfully");
  }

  // async lockSeat(req: AuthReq, res: Response) {
  //   const data = await validateDto(LockSeatDto, {
  //     ...req.body,
  //     eventId: req.params.eventId,
  //     seatId: req.params.seatId,
  //   });
  //   const result = await this.seatService.lockSeat(eventId, seatId, dto);
  //   sendResponse(res, StatusCodes.OK, result, "Seat locked successfully");
  // }
}
