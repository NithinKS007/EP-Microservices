import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IPaymentRepository, PaymentModel } from "../interface/IPayment.repository";

type TModel = Prisma.PaymentGetPayload<Prisma.PaymentFindUniqueArgs>;
type TCreate = Prisma.PaymentCreateArgs["data"];
type TUpdate = Prisma.PaymentUpdateArgs["data"];
type TWhere = Prisma.PaymentWhereInput;

export class PaymentRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
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

  async findByOrderId(orderId: string): Promise<PaymentModel | null> {
    return await this.prisma.payment.findFirst({
      where: {
        providerRef: orderId,
      },
    });
  }

  async findPaymentsByBookingIds(bookingIds: string[]): Promise<PaymentModel[]> {
    if (bookingIds.length === 0) {
      return [];
    }

    return await this.prisma.payment.findMany({
      where: {
        bookingId: { in: bookingIds },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async bulkRefundPayments(
    bookingIds: string[],
  ): Promise<{ refundedCount: number; failedCount: number }> {
    if (bookingIds.length === 0) {
      return { refundedCount: 0, failedCount: 0 };
    }

    const refunded = await this.prisma.payment.updateMany({
      where: {
        bookingId: { in: bookingIds },
        status: "SUCCESS",
      },
      data: {
        status: "REFUNDED",
      },
    });

    const failed = await this.prisma.payment.updateMany({
      where: {
        bookingId: { in: bookingIds },
        status: "INITIATED",
      },
      data: {
        status: "FAILED",
      },
    });

    return {
      refundedCount: refunded.count,
      failedCount: failed.count,
    };
  }

  async findByBookingId(bookingId: string): Promise<PaymentModel | null> {
    return await this.prisma.payment.findFirst({
      where: {
        bookingId,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
