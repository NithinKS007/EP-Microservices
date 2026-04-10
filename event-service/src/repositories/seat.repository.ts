import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { ISeatRepository, SeatModel } from "./../interface/ISeat.repository";
import { GetSeatsQueryDto } from "dtos/seat.dtos";

type TModel = Prisma.SeatGetPayload<Prisma.SeatFindUniqueArgs>;
type TCreate = Prisma.SeatCreateArgs["data"];
type TUpdate = Prisma.SeatUpdateArgs["data"];
type TWhere = Prisma.SeatWhereInput;

export class SeatRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
  implements ISeatRepository
{
  private prisma: PrismaClient | Prisma.TransactionClient;

  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.seat));
    this.prisma = prisma;
  }

  async bulkCreateSeats(data: Prisma.SeatCreateManyInput[]): Promise<void> {
    await this.prisma.seat.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async findSeatNumbersByEvent(eventId: string, seatNumbers: string[]): Promise<string[]> {
    const existingSeats = await this.prisma.seat.findMany({
      where: { eventId, seatNumber: { in: seatNumbers } },
      select: { seatNumber: true },
    });
    return existingSeats.map((s) => s.seatNumber);
  }

  async findSeatsWithPagination(
    dtos: GetSeatsQueryDto,
  ): Promise<{ data: SeatModel[]; meta: { total: number; page: number; limit: number } }> {
    const { eventId, limit, page, seatStatus, seatTier } = dtos;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.seat.findMany({
        skip,
        take: limit,
        where: { eventId, seatStatus, seatTier },
      }),
      this.prisma.seat.count({ where: { eventId, seatStatus, seatTier } }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  /**
   * Attempts to lock all requested seats atomically enough for booking retries.
   * Used in: Booking Saga (Step: Seat Lock)
   * Triggered via: gRPC
   */
  async lockSeats(
    bookingId: string,
    eventId: string,
    expiryDate: Date,
    seatIds: string[],
  ): Promise<number> {
    const result = await this.prisma.seat.updateMany({
      where: {
        eventId,
        id: { in: seatIds },
        OR: [
          { seatStatus: "AVAILABLE" },
          {
            seatStatus: "LOCKED",
            lockExpiresAt: {
              lt: new Date(),
            },
          },
        ],
      },
      data: { seatStatus: "LOCKED", lockedByBookingId: bookingId, lockExpiresAt: expiryDate },
    });

    if (result.count !== seatIds.length) {
      await this.prisma.seat.updateMany({
        where: {
          eventId,
          id: { in: seatIds },
          lockedByBookingId: bookingId,
          seatStatus: "LOCKED",
        },
        data: {
          seatStatus: "AVAILABLE",
          lockedByBookingId: null,
          lockExpiresAt: null,
        },
      });
    }

    return result.count;
  }

  async confirmSeats(bookingId: string): Promise<void> {
    await this.prisma.seat.updateMany({
      where: {
        lockedByBookingId: bookingId,
        seatStatus: "LOCKED",
        lockExpiresAt: {
          gt: new Date(),
        },
      },
      data: {
        seatStatus: "SOLD",
      },
    });
  }

  async releaseSeats(bookingId: string) {
    await this.prisma.seat.updateMany({
      where: {
        lockedByBookingId: bookingId,
        seatStatus: "LOCKED",
      },
      data: {
        seatStatus: "AVAILABLE",
        lockedByBookingId: null,
        lockExpiresAt: null,
      },
    });
  }

  async resetSeatsForBooking(bookingId: string): Promise<void> {
    await this.prisma.seat.updateMany({
      where: {
        lockedByBookingId: bookingId,
        seatStatus: {
          in: ["LOCKED", "SOLD"],
        },
      },
      data: {
        seatStatus: "AVAILABLE",
        lockedByBookingId: null,
        lockExpiresAt: null,
      },
    });
  }

  async bulkReleaseSeatsForBookings(bookingIds: string[]): Promise<number> {
    if (bookingIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.seat.updateMany({
      where: {
        lockedByBookingId: {
          in: bookingIds,
        },
        seatStatus: {
          in: ["LOCKED", "SOLD"],
        },
      },
      data: {
        seatStatus: "AVAILABLE",
        lockedByBookingId: null,
        lockExpiresAt: null,
      },
    });

    return result.count;
  }

  async countSoldSeats(eventId: string): Promise<number> {
    return await this.prisma.seat.count({
      where: { eventId, seatStatus: "SOLD" },
    });
  }

  async countLockedSeats(eventId: string): Promise<number> {
    return await this.prisma.seat.count({
      where: { eventId, seatStatus: "LOCKED" },
    });
  }

  async findNotAvailableSeats(seatIds: string[], eventId: string): Promise<SeatModel[]> {
    return await this.prisma.seat.findMany({
      where: {
        id: { in: seatIds },
        eventId: eventId,
        OR: [
          { seatStatus: "SOLD" },
          {
            seatStatus: "LOCKED",
            OR: [{ lockExpiresAt: null }, { lockExpiresAt: { gte: new Date() } }],
          },
        ],
      },
    });
  }
}
