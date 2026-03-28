import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

export type OutboxEventModel = Prisma.OutboxEventGetPayload<{}>;
export type OutboxEventCreateData = Prisma.OutboxEventCreateInput;
export type OutboxEventUpdateData = Prisma.OutboxEventUpdateInput;
export type OutboxEventWhere = Prisma.OutboxEventWhereInput;

export interface IOutboxEventRepository
  extends DatabaseAdapter<
    OutboxEventModel,
    OutboxEventCreateData,
    OutboxEventUpdateData,
    OutboxEventWhere
  > {
  fetchBatch(limit: number): Promise<OutboxEventModel[]>;
  updateMany(ids: string[], data: OutboxEventUpdateData): Promise<void>;
}
