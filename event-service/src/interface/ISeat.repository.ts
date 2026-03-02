import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";
import { GetSeatsQueryDto } from "./../dtos/seat.dtos";

/**
 * Prisma-backed Seat domain model
 */
export type SeatModel = Prisma.SeatGetPayload<{}>;

/**
 * Repository operation types
 */
export type SeatCreateData = Prisma.SeatCreateInput;
export type SeatUpdateData = Prisma.SeatUpdateInput;
export type SeatWhere = Prisma.SeatWhereInput;
export type SeatFindManyArgs = Prisma.SeatFindManyArgs;

/**
 * Seat Repository contract
 */
export interface ISeatRepository extends DatabaseAdapter<
  SeatModel,
  SeatCreateData,
  SeatUpdateData,
  SeatWhere,
  SeatFindManyArgs
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

  findSeatsWithPagination(
    data: GetSeatsQueryDto,
  ): Promise<{ data: SeatModel[]; meta: { total: number; page: number; limit: number } }>;
}
