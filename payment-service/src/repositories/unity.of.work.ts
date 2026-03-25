import { AwilixContainer } from "awilix";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { container } from "../container";
import { PaymentRepository } from "./payment.repository";
import { PaymentEventRepository } from "./payment.event.repository";
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
      paymentRepository: PaymentRepository;
      paymentEventRepository: PaymentEventRepository;
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
          paymentRepository: scopedContainer.resolve<PaymentRepository>("paymentRepository"),
          paymentEventRepository:
            scopedContainer.resolve<PaymentEventRepository>("paymentEventRepository"),
          outboxEventRepository:
            scopedContainer.resolve<OutboxEventRepository>("outboxEventRepository"),
        };

        return callback({ ...repos });
      },
      { timeout: 700000 },
    );
  }
}
