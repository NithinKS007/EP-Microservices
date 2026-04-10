import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { SagaModel, ISagaRepository } from "interface/ISaga.repository";

type TModel = Prisma.SagaGetPayload<Prisma.SagaFindUniqueArgs>;
type TCreate = Prisma.SagaCreateArgs["data"];
type TUpdate = Prisma.SagaUpdateArgs["data"];
type TWhere = Prisma.SagaWhereInput;

export class SagaRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
  implements ISagaRepository
{
  private readonly prisma: PrismaClient | Prisma.TransactionClient;

  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.saga));
    this.prisma = prisma;
  }

  async findByTypeAndReferenceId(sagaType: string, referenceId: string): Promise<SagaModel | null> {
    return await this.prisma.saga.findFirst({
      where: { sagaType, referenceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAbandonedSagas(timeoutMinutes: number): Promise<SagaModel[]> {
    const cutoffDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    return await this.prisma.saga.findMany({
      where: {
        status: { in: ["started", "in_progress"] },
        updatedAt: { lt: cutoffDate },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}
