import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed Event domain model
 */
export type EventModel = Prisma.EventGetPayload<{}>;

/**
 * Repository operation types
 */
export type EventCreateData = Prisma.EventCreateInput;
export type EventUpdateData = Prisma.EventUpdateInput;
export type EventWhere = Prisma.EventWhereInput;
export type EventFindManyArgs = Prisma.EventFindManyArgs;

/**
 * Event Repository contract
 */
export interface IEventRepository extends DatabaseAdapter<
  EventModel,
  EventCreateData,
  EventUpdateData,
  EventWhere,
  EventFindManyArgs
> {
  /**
   * Find an event by date, venue name and name
   */
  findExisting(
    eventDate: Date,
    venueName: string,
    name: string,
    id?: string,
  ): Promise<EventModel | null>;

  /**
   * Find events with pagination
   */
  findEventsWithPagination({
    limit,
    page,
  }: {
    limit: number;
    page: number;
  }): Promise<{ data: EventModel[]; meta: { total: number; page: number; limit: number } }>;
}
