import { AwilixContainer } from "awilix";
import { Prisma, PrismaClient } from "./../generated/prisma/client";
import { container } from "./../container";
import { EventRepository } from "./event.repository";
import { SeatRepository } from "./seat.repository";

/**
 * Wraps multiple repository operations inside a single Prisma transaction.
 */
export class UnitOfWork {
  private readonly prisma: PrismaClient;
  private readonly container: AwilixContainer;

  constructor({ prisma }: { prisma: PrismaClient }) {
    this.prisma = prisma;
    this.container = container;
  }

  async withTransaction<T>(
    callback: (repos: {
      eventRepository: EventRepository;
      seatRepository: SeatRepository;
    }) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const scopedContainer = this.container.createScope();

        // Override PrismaClient binding with transaction client
        scopedContainer.register({
          prisma: { resolve: () => tx },
        });

        const repos = {
          eventRepository: scopedContainer.resolve<EventRepository>("eventRepository"),
          seatRepository: scopedContainer.resolve<SeatRepository>("seatRepository"),
        };

        return callback({ ...repos });
      },
      { timeout: 700000 },
    );
  }
}
