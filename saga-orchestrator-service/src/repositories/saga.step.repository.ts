import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { ISagaStepRepository, SagaStepModel } from "./../interface/ISaga.step.repository";

type TModel = Prisma.SagaStepGetPayload<Prisma.SagaStepFindUniqueArgs>;
type TCreate = Prisma.SagaStepCreateArgs["data"];
type TUpdate = Prisma.SagaStepUpdateArgs["data"];
type TWhere = Prisma.SagaStepWhereInput;

export class SagaStepRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
  implements ISagaStepRepository
{
  private prisma: PrismaClient | Prisma.TransactionClient;

  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.sagaStep));
    this.prisma = prisma;
  }

  async findBySagaId(sagaId: string): Promise<SagaStepModel[]> {
    return await this.prisma.sagaStep.findMany({
      where: { sagaId },
      orderBy: { stepOrder: "asc" },
    });
  }

  /**
   * Resets non-terminal steps before a failed saga restart.
   * Used in: Cancel Event Saga restart
   * Triggered via: Saga step
   */
  async resetRetryableSteps(sagaId: string): Promise<void> {
    await this.prisma.sagaStep.updateMany({
      where: {
        sagaId,
        status: {
          notIn: ["completed", "skipped"],
        },
      },
      data: {
        status: "pending",
        retryCount: 0,
        errorMessage: null
      },
    });
  }

  /**
   * Resets all steps (including completed) for a hard restart.
   * Used in: Fully failed/compensated Saga restart
   * Triggered via: Saga Orchestrator
   */
  async resetAllSteps(sagaId: string): Promise<void> {
    await this.prisma.sagaStep.updateMany({
      where: { sagaId },
      data: {
        status: "pending",
        retryCount: 0,
        errorMessage: null
      },
    });
  }
}
