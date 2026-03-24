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
  private readonly prisma: PrismaClient | Prisma.TransactionClient;

  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.payment));
    this.prisma = prisma;
  }
  async updateManyPaymentsNotSuccess(paymentId: string): Promise<Prisma.BatchPayload> {
    const result = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: { not: "SUCCESS" },
      },
      data: {
        status: "SUCCESS",
        updatedAt: new Date(),
      },
    });

    return result;
  }

  async updateManyPaymentsNotFailed(paymentId: string): Promise<Prisma.BatchPayload> {
    const result = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: { not: "FAILED" },
      },
      data: {
        status: "FAILED",
        updatedAt: new Date(),
      },
    });

    return result;
  }
}
