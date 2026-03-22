import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed OutboxEvent domain model
 */
export type OutboxEventModel = Prisma.OutboxEventGetPayload<{}>;

/**
 * Types for repository operations
 */
export type OutboxEventCreateData = Prisma.OutboxEventCreateInput;
export type OutboxEventUpdateData = Prisma.OutboxEventUpdateInput;
export type OutboxEventWhere = Prisma.OutboxEventWhereInput;
export type OutboxEventFindManyArgs = Prisma.OutboxEventFindManyArgs;

/**
 * OutboxEvent Repository contract
 * Defines all supported persistence operations for OutboxEvent entity
 */
export interface IOutboxEventRepository extends DatabaseAdapter<
  OutboxEventModel,
  OutboxEventCreateData,
  OutboxEventUpdateData,
  OutboxEventWhere,
  OutboxEventFindManyArgs
> {
  fetchBatch(limit: number): Promise<OutboxEventModel[]>;
  updateMany(ids: string[], data: OutboxEventUpdateData): Promise<void>;
}
