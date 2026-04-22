import { AwilixContainer } from "awilix";
import { Prisma, PrismaClient } from "./../generated/prisma/client";
import { container } from "./../container";
import { BookingRepository } from "./booking.repository";
import { BookingSeatRepository } from "./booking.seat.repository";
import { OutboxEventRepository } from "./outbox.event.repository";

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
      bookingRepository: BookingRepository;
      bookingSeatRepository: BookingSeatRepository;
      outboxEventRepository: OutboxEventRepository;
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
          bookingRepository: scopedContainer.resolve<BookingRepository>("bookingRepository"),
          bookingSeatRepository:
            scopedContainer.resolve<BookingSeatRepository>("bookingSeatRepository"),
          outboxEventRepository:
            scopedContainer.resolve<OutboxEventRepository>("outboxEventRepository"),
        };

        return callback({ ...repos });
      },
      { timeout: 30000 },
    );
  }
}
