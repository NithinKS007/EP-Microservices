import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed BookingSeat domain model
 */
export type BookingSeatModel = Prisma.BookingSeatGetPayload<{}>;

/**
 * Types for repository operations
 */
export type BookingSeatCreateData = Prisma.BookingSeatCreateInput;
export type BookingSeatUpdateData = Prisma.BookingSeatUpdateInput;
export type BookingSeatWhere = Prisma.BookingSeatWhereInput;
export type BookingSeatFindManyArgs = Prisma.BookingSeatFindManyArgs;

/**
 * BookingSeat Repository contract
 * Defines all supported persistence operations for BookingSeat entity
 */
export interface IBookingSeatRepository extends DatabaseAdapter<
  BookingSeatModel,
  BookingSeatCreateData,
  BookingSeatUpdateData,
  BookingSeatWhere,
  BookingSeatFindManyArgs
> {}
