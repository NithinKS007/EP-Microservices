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

  async findBookingsByEventId(eventId: string): Promise<TModel[]> {
    return await this.prisma.booking.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
  }
}
