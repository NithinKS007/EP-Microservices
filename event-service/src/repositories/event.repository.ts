import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { EventModel, IEventRepository } from "interface/IEvent.repository";

type TModel = Prisma.EventGetPayload<Prisma.EventFindUniqueArgs>;
type TCreate = Prisma.EventCreateArgs["data"];
type TUpdate = Prisma.EventUpdateArgs["data"];
type TWhere = Prisma.EventWhereInput;

export class EventRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
  implements IEventRepository
{
  private readonly prisma: PrismaClient | Prisma.TransactionClient;
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.event));
    this.prisma = prisma;
  }

  async findExisting(
    eventDate: Date,
    venueName: string,
    name: string,
    id?: string,
  ): Promise<EventModel | null> {
    return await this.prisma.event.findFirst({
      where: {
        eventDate,
        venueName,
        name,
        ...(id && {
          id: {
            not: id,
          },
        }),
      },
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
      this.prisma.event.findMany({
        skip,
        take: limit,
        orderBy: {
          eventDate: "desc",
        },
      }),
      this.prisma.event.count({}),
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

  async findEventsByIdsWithSeats(eventIds: string[]): Promise<Prisma.EventGetPayload<{
    include: {
      seats: true;
    };
  }>[]> {
    if (eventIds.length === 0) {
      return [];
    }

    return await this.prisma.event.findMany({
      where: {
        id: {
          in: eventIds,
        },
      },
      include: {
        seats: true,
      },
      orderBy: {
        eventDate: "desc",
      },
    });
  }
}
