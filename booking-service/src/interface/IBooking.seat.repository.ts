import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed BookingSeat domain model
 */
export type BookingSeatModel = Prisma.BookingSeatGetPayload<Prisma.BookingSeatDefaultArgs>;

/**
 * Types for repository operations
 */
export type BookingSeatCreateData = Prisma.BookingSeatCreateInput;
export type BookingSeatUpdateData = Prisma.BookingSeatUpdateInput;
export type BookingSeatWhere = Prisma.BookingSeatWhereInput;

/**
 * BookingSeat Repository contract
 * Defines all supported persistence operations for BookingSeat entity
 */
export type IBookingSeatRepository = DatabaseAdapter<
  BookingSeatModel,
  BookingSeatCreateData,
  BookingSeatUpdateData,
  BookingSeatWhere
>;
