import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IPaymentRepository } from "../interface/IPayment.repository";

type TModel = Prisma.PaymentGetPayload<Prisma.PaymentFindUniqueArgs>;
type TCreate = Prisma.PaymentCreateArgs["data"];
type TUpdate = Prisma.PaymentUpdateArgs["data"];
type TWhere = Prisma.PaymentWhereInput;
type TFindManyArgs = Prisma.PaymentFindManyArgs;

export class PaymentRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IPaymentRepository
{
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.payment));
  }
}
