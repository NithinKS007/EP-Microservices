import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IOutboxEventRepository, OutboxEventModel } from "../interface/IOutbox.event.repository";

type TModel = Prisma.OutboxEventGetPayload<Prisma.OutboxEventFindUniqueArgs>;
type TCreate = Prisma.OutboxEventCreateArgs["data"];
type TUpdate = Prisma.OutboxEventUpdateArgs["data"];
type TWhere = Prisma.OutboxEventWhereInput;
type TFindManyArgs = Prisma.OutboxEventFindManyArgs;

export class OutboxEventRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IOutboxEventRepository
{
  private readonly prisma: PrismaClient | Prisma.TransactionClient;

  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.outboxEvent));
    this.prisma = prisma;
  }

  async fetchBatch(limit: number): Promise<OutboxEventModel[]> {
    return await this.prisma.$queryRaw<OutboxEventModel[]>`
    SELECT * FROM outbox_events
    WHERE status = 'PENDING'
    AND next_retry_at <= NOW()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT ${limit}
  `;
  }

  async updateMany(ids: string[], data: TUpdate): Promise<void> {
    await this.adapter.updateMany({ id: { in: ids } }, data);
  }
}
