import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";
import { GetBookingsQueryDto } from "./../dtos/booking.dtos";

/**
 * Prisma-backed Booking domain model
 */
export type BookingModel = Prisma.BookingGetPayload<{}>;

/**
 * Types for repository operations
 */
export type BookingCreateData = Prisma.BookingCreateInput;
export type BookingUpdateData = Prisma.BookingUpdateInput;
export type BookingWhere = Prisma.BookingWhereInput;

/**
 * Booking Repository contract
 * Defines all supported persistence operations for Booking entity
 */
export interface IBookingRepository extends DatabaseAdapter<
  BookingModel,
  BookingCreateData,
  BookingUpdateData,
  BookingWhere
> {
  findByIdempotencyKey(idempotencyKey: string): Promise<BookingModel | null>;
  findBookingsByEventId(eventId: string): Promise<BookingModel[]>;
  bulkCancelBookings(bookingIds: string[]): Promise<number>;
  findExpiredPendingBookings(limit?: number): Promise<BookingModel[]>;
  bulkExpireBookings(bookingIds: string[]): Promise<number>;
  findPaginatedBookingsWithSeats(data: GetBookingsQueryDto): Promise<{
    data: Prisma.BookingGetPayload<{
      include: {
        bookingSeats: true;
      };
    }>[];
    meta: { total: number; page: number; limit: number };
  }>;
}
