import { BookingService } from "./../services/booking.service";
import { AuthReq, sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { Response } from "express";
import { CreateBookingDto } from "./../dtos/booking.dtos";

export class BookingController {
  private readonly bookingService: BookingService;
  constructor({ bookingService }: { bookingService: BookingService }) {
    this.bookingService = bookingService;
  }

  async create(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(CreateBookingDto, {...req.body, userId: req?.user?.id});
    // const idempotencyKey = req.headers['idempotency-key'];
    await this.bookingService.create(data);
    sendResponse(res, StatusCodes.Created, null, "Booking created successfully");
  }
}
