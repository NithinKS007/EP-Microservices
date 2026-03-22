import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IBookingSeatRepository } from "../interface/IBooking.seat.repository";

type TModel = Prisma.BookingSeatGetPayload<Prisma.BookingSeatFindUniqueArgs>;
type TCreate = Prisma.BookingSeatCreateArgs["data"];
type TUpdate = Prisma.BookingSeatUpdateArgs["data"];
type TWhere = Prisma.BookingSeatWhereInput;
type TFindManyArgs = Prisma.BookingSeatFindManyArgs;

export class BookingSeatRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IBookingSeatRepository
{
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.bookingSeat));
  }
}
