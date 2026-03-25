import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

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
> {}
