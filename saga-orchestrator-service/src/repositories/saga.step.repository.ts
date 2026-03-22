import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { ISagaStepRepository, SagaStepModel } from "./../interface/ISaga.step.repository";

type TModel = Prisma.SagaStepGetPayload<Prisma.SagaStepFindUniqueArgs>;
type TCreate = Prisma.SagaStepCreateArgs["data"];
type TUpdate = Prisma.SagaStepUpdateArgs["data"];
type TWhere = Prisma.SagaStepWhereInput;
type TFindManyArgs = Prisma.SagaStepFindManyArgs;

export class SagaStepRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements ISagaStepRepository
{
  private prisma: PrismaClient | Prisma.TransactionClient;

  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.sagaStep));
    this.prisma = prisma;
  }
}
