import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";
import { GetSeatsQueryDto } from "./../dtos/seat.dtos";

/**
 * Prisma-backed Seat domain model
 */
export type SeatModel = Prisma.SeatGetPayload<Prisma.SeatDefaultArgs>;

/**
 * Repository operation types
 */
export type SeatCreateData = Prisma.SeatCreateInput;
export type SeatUpdateData = Prisma.SeatUpdateInput;
export type SeatWhere = Prisma.SeatWhereInput;

/**
 * Seat Repository contract
 */
export interface ISeatRepository extends DatabaseAdapter<
  SeatModel,
  SeatCreateData,
  SeatUpdateData,
  SeatWhere
> {
  /**
   * Bulk create seats for an event
   *
   * @param data - Array of seat data to create
   * @returns void
   * */
  bulkCreateSeats(data: Prisma.SeatCreateManyInput[]): Promise<void>;

  /**
   * Find seat numbers by event
   *
   * @param eventId - Event ID
   * @param seatNumbers - Array of seat numbers to find
   * @returns Array of seat numbers
   * */
  findSeatNumbersByEvent(eventId: string, seatNumbers: string[]): Promise<string[]>;

  /**
   * Find seats with pagination
   *
   * @param data - GetSeatsQueryDto
   * @returns { data: SeatModel[], meta: { total: number; page: number; limit: number } }
   * */
  findSeatsWithPagination(
    data: GetSeatsQueryDto,
  ): Promise<{ data: SeatModel[]; meta: { total: number; page: number; limit: number } }>;

  /**
   * Lock seats
   *
   * @param bookingId - Booking ID
   * @param eventId - Event ID
   * @param expiryDate - Expiry date
   * @param seatNumbers - Array of seat numbers to lock
   * @returns void
   * */
  lockSeats(
    bookingId: string,
    eventId: string,
    expiryDate: Date,
    seatNumbers: string[],
  ): Promise<number>;

  /**
   * Confirm seats
   *
   * @returns number of affected rows
   * */
  confirmSeats(bookingId: string): Promise<number>;

  /**
   * Release seats
   *
   * @param bookingId - Booking ID
   * @returns void
   * */
  releaseSeats(bookingId: string): Promise<void>;

  /**
   * Reset seats reserved or sold under a booking back to available.
   * Used when an admin cancels an event and related bookings must be unwound.
   */
  resetSeatsForBooking(bookingId: string): Promise<void>;
  bulkReleaseSeatsForBookings(bookingIds: string[]): Promise<number>;

  /**
   * Count sold seats
   *
   * @param eventId - Event ID
   * @returns number
   * */
  countSoldSeats(eventId: string): Promise<number>;

  /**
   * Count locked seats for an event
   */
  countLockedSeats(eventId: string): Promise<number>;
  countSoldSeatsForBooking(bookingId: string): Promise<number>;

  findNotAvailableSeats(seatIds: string[], eventId: string): Promise<SeatModel[]>;
  findSeatsByIds(seatIds: string[]): Promise<SeatModel[]>;
}
