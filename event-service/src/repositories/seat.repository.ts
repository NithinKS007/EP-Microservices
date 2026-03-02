import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { ISeatRepository, SeatModel } from "./../interface/ISeat.repository";
import { GetSeatsQueryDto } from "dtos/seat.dtos";

type TModel = Prisma.SeatGetPayload<Prisma.SeatFindUniqueArgs>;
type TCreate = Prisma.SeatCreateArgs["data"];
type TUpdate = Prisma.SeatUpdateArgs["data"];
type TWhere = Prisma.SeatWhereInput;
type TFindManyArgs = Prisma.SeatFindManyArgs;

export class SeatRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
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
      this.findMany({
        skip,
        take: limit,
        where: { eventId, seatStatus, seatTier },
      }),
      this.count({ eventId, seatStatus, seatTier }),
    ]);

    return { data, meta: { total, page, limit } };
  }
}
