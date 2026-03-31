import { BookingService } from "./../services/booking.service";
import { AuthReq, sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { Response } from "express";
import { CreateBookingDto, GetBookingByIdRequestDto, GetBookingsQueryDto } from "./../dtos/booking.dtos";

export class BookingController {
  private readonly bookingService: BookingService;
  constructor({ bookingService }: { bookingService: BookingService }) {
    this.bookingService = bookingService;
  }

  /**
   * Creates a booking request and forwards the idempotency key when present.
   * Used in: Booking create flow
   * Triggered via: REST
   */
  async create(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(CreateBookingDto, { ...req.body, userId: req?.user?.id });
    const rawIdempotencyKey = req.headers["idempotency-key"];
    const idempotencyKey =
      typeof rawIdempotencyKey === "string" ? rawIdempotencyKey.trim() : undefined;

    await this.bookingService.create(data, idempotencyKey || undefined);
    sendResponse(res, StatusCodes.Created, null, "Booking created successfully");
  }

  async findBookingsWithPagination(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(GetBookingsQueryDto, req.query);
    const bookings = await this.bookingService.findBookingsWithPagination(data);
    sendResponse(res, StatusCodes.OK, bookings, "Bookings fetched successfully");
  }

  async findBookingByIdWithDetails(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(GetBookingByIdRequestDto, req.params);
    const booking = await this.bookingService.findBookingByIdWithDetails(data.id);
    sendResponse(res, StatusCodes.OK, booking, "Booking fetched successfully");
  }
}
