import { BookingService } from "./../services/booking.service";
import { AuthReq, sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { Response } from "express";
import {
  BookingActionRequestDto,
  CreateBookingDto,
  GetBookingByIdRequestDto,
  GetBookingsQueryDto,
} from "./../dtos/booking.dtos";

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

  /**
   * Confirms a booking manually after payment success has been verified.
   * Used in: Booking manual recovery flow
   * Triggered via: REST
   */
  async confirm(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(BookingActionRequestDto, req.params);
    const booking = await this.bookingService.confirmBooking(data.id, req.user);
    sendResponse(res, StatusCodes.OK, null, "Booking confirmed successfully");
  }

  /**
   * Cancels a booking safely and releases its seats when applicable.
   * Used in: Booking cancellation flow
   * Triggered via: REST
   */
  async cancel(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(BookingActionRequestDto, req.params);
    const booking = await this.bookingService.cancelBooking(data.id, req.user);
    sendResponse(res, StatusCodes.OK, null, "Booking cancelled successfully");
  }

  /**
   * Expires a booking immediately and releases its seats when applicable.
   * Used in: Booking forced-expiry flow
   * Triggered via: REST
   */
  async expire(req: AuthReq, res: Response): Promise<void> {
    const data = await validateDto(BookingActionRequestDto, req.params);
    const booking = await this.bookingService.expireBooking(data.id, req.user);
    sendResponse(res, StatusCodes.OK, null, "Booking expired successfully");
  }
}
