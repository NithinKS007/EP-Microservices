import { AwilixContainer } from "awilix";
import { Prisma, PrismaClient } from "./../generated/prisma/client";
import { container } from "./../container";
import { SagaRepository } from "./saga.repository";
import { SagaStepRepository } from "./saga.step.repository";
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
      sagaRepository: SagaRepository;
      sagaStepRepository: SagaStepRepository;
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
          sagaRepository: scopedContainer.resolve<SagaRepository>("sagaRepository"),
          sagaStepRepository: scopedContainer.resolve<SagaStepRepository>("sagaStepRepository"),
          outboxEventRepository:
            scopedContainer.resolve<OutboxEventRepository>("outboxEventRepository"),
        };

        return callback({ ...repos });
      },
      { timeout: 700000 },
    );
  }
}
