import { CronRunner, logger } from "../../../utils/src";
import { ISagaRepository } from "../interface/ISaga.repository";
import { UnitOfWork } from "../repositories/unity.of.work";

export class SagaRecoveryJob {
  private readonly cronRunner: CronRunner;
  private readonly sagaRepository: ISagaRepository;
  private readonly unitOfWork: UnitOfWork;

  constructor({
    cronRunner,
    sagaRepository,
    unitOfWork,
  }: {
    cronRunner: CronRunner;
    sagaRepository: ISagaRepository;
    unitOfWork: UnitOfWork;
  }) {
    this.cronRunner = cronRunner;
    this.sagaRepository = sagaRepository;
    this.unitOfWork = unitOfWork;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }

  start() {
    this.cronRunner.schedule("Saga Recovery Job", "*/5 * * * *", async () => {
      await this.recoverAbandonedSagas();
    });
  }

  /**
   * Recovers sagas stuck in 'started' or 'in_progress' for more than 10 minutes.
   * Used in: Saga Orchestrator recovery flow
   * Triggered via: Cron job
   */
  public async recoverAbandonedSagas() {
    const TIMEOUT_MINUTES = 10;

    // Find sagas that haven't been updated in 10 minutes and are still running
    const abandonedSagas = await this.sagaRepository.findAbandonedSagas(TIMEOUT_MINUTES);

    if (!abandonedSagas.length) {
      return;
    }

    logger.warn(`Found ${abandonedSagas.length} abandoned Sagas. Initiating recovery...`);

    for (const saga of abandonedSagas) {
      try {
        await this.unitOfWork.withTransaction(async (repos) => {
          if (saga.sagaType === "CANCEL_EVENT") {
            // Re-trigger the saga handle logic by pushing a fresh outbox event
            // The event consumer is idempotent and will resume missing steps
            await repos.outboxEventRepository.create({
              topic: "saga.cancel.event.requested",
              payload: {
                sagaId: saga.id,
                eventId: saga.referenceId,
              },
              status: "PENDING",
            });
            logger.info(`Successfully pushed recovery event for CANCEL_EVENT sagaId=${saga.id}`);
          } else {
            // Standard sync sagas like INITIATE_PAYMENT cannot be automatically resumed via outbox
            // as they lack a persistent consumer. Mark as failed to allow manual review/retry.
            await repos.sagaRepository.update(
              { id: saga.id },
              {
                status: "failed",
                errorMessage: "Saga recovery: Abandoned sync saga marked as failed.",
              },
            );
            logger.warn(`Marked abandoned sync saga as failed: sagaId=${saga.id}, type=${saga.sagaType}`);
          }

          // Bump updatedAt so we don't pick it up again quickly
          await repos.sagaRepository.update({ id: saga.id }, { updatedAt: new Date() });
        });
      } catch (err: unknown) {
        logger.error(
          `Failed to push recovery event for sagaId=${saga.id}: ${this.getErrorMessage(err)}`,
        );
      }
    }
  }
}
