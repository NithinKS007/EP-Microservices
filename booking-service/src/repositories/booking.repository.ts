import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IBookingRepository } from "../interface/IBooking.repository";

type TModel = Prisma.BookingGetPayload<Prisma.BookingFindUniqueArgs>;
type TCreate = Prisma.BookingCreateArgs["data"];
type TUpdate = Prisma.BookingUpdateArgs["data"];
type TWhere = Prisma.BookingWhereInput;

export class BookingRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
  implements IBookingRepository
{
  private readonly prisma: PrismaClient | Prisma.TransactionClient;

  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.booking));
    this.prisma = prisma;
  }

  /**
   * Finds an existing booking by idempotency key.
   * Used in: Booking REST create flow
   * Triggered via: REST
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<TModel | null> {
    return await this.prisma.booking.findUnique({
      where: { idempotencyKey },
    });
  }

  /**
   * Lists bookings for a given event.
   * Used in: Cancel Event Saga
   * Triggered via: gRPC
   */
  async findBookingsByEventId(eventId: string): Promise<TModel[]> {
    return await this.prisma.booking.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Cancels non-terminal bookings in bulk.
   * Used in: Cancel Event Saga (Step: Booking Service)
   * Triggered via: gRPC
   */
  async bulkCancelBookings(bookingIds: string[]): Promise<number> {
    if (bookingIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.booking.updateMany({
      where: {
        id: { in: bookingIds },
        status: {
          notIn: ["CANCELLED", "EXPIRED"],
        },
      },
      data: {
        status: "CANCELLED",
      },
    });

    return result.count;
  }

  /**
   * Finds bookings that expired before payment completion.
   * Used in: Booking expiry cleanup flow
   * Triggered via: Cron job
   */
  async findExpiredPendingBookings(limit = 100): Promise<TModel[]> {
    return await this.prisma.booking.findMany({
      where: {
        expiresAt: { lt: new Date() },
        status: {
          in: ["PENDING", "PAYMENT_INITIATED"],
        },
      },
      orderBy: { expiresAt: "asc" },
      take: limit,
    });
  }

  /**
   * Marks expired open bookings as EXPIRED in bulk.
   * Used in: Booking expiry cleanup flow
   * Triggered via: Cron job
   */
  async bulkExpireBookings(bookingIds: string[]): Promise<number> {
    if (bookingIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.booking.updateMany({
      where: {
        id: { in: bookingIds },
        status: {
          in: ["PENDING", "PAYMENT_INITIATED"],
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return result.count;
  }
}
