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
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.saga));
  }
}
