import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { EventModel, IEventRepository } from "interface/IEvent.repository";

type TModel = Prisma.EventGetPayload<Prisma.EventFindUniqueArgs>;
type TCreate = Prisma.EventCreateArgs["data"];
type TUpdate = Prisma.EventUpdateArgs["data"];
type TWhere = Prisma.EventWhereInput;
type TFindManyArgs = Prisma.EventFindManyArgs;

export class EventRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IEventRepository
{
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.event));
  }

  async findExisting(
    eventDate: Date,
    venueName: string,
    name: string,
    id?: string,
  ): Promise<EventModel | null> {
    return await this.findOne({
      eventDate,
      venueName,
      name,
      ...(id && {
        id: {
          not: id,
        },
      }),
    });
  }

  async findEventsWithPagination({
    limit,
    page,
  }: {
    limit: number;
    page: number;
  }): Promise<{ data: EventModel[]; meta: { total: number; page: number; limit: number } }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.findMany({
        skip,
        take: limit,
        orderBy: {
          eventDate: "desc",
        },
      }),
      this.count({}),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }
}
