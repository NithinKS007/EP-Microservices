import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IBookingRepository } from "../interface/IBooking.repository";

type TModel = Prisma.BookingGetPayload<Prisma.BookingFindUniqueArgs>;
type TCreate = Prisma.BookingCreateArgs["data"];
type TUpdate = Prisma.BookingUpdateArgs["data"];
type TWhere = Prisma.BookingWhereInput;
type TFindManyArgs = Prisma.BookingFindManyArgs;

export class BookingRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IBookingRepository
{
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.booking));
  }
}
