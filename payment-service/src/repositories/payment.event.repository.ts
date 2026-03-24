import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IPaymentEventRepository } from "../interface/IPayment.event.repository";

type TModel = Prisma.PaymentEventGetPayload<Prisma.PaymentEventFindUniqueArgs>;
type TCreate = Prisma.PaymentEventCreateArgs["data"];
type TUpdate = Prisma.PaymentEventUpdateArgs["data"];
type TWhere = Prisma.PaymentEventWhereInput;
type TFindManyArgs = Prisma.PaymentEventFindManyArgs;

export class PaymentEventRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IPaymentEventRepository
{
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.paymentEvent));
  }
}
