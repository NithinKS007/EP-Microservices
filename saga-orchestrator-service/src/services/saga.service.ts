import { ISagaRepository } from "interface/ISaga.repository";
import { ValidationError } from "../../../utils/src/error.handling.middleware";
import { UnitOfWork } from "../repositories/unity.of.work";

export class SagaService {
  private readonly sagaRepository: ISagaRepository;
  private readonly unitOfWork: UnitOfWork;

  constructor({
    sagaRepository,
    unitOfWork,
  }: {
    sagaRepository: ISagaRepository;
    unitOfWork: UnitOfWork;
  }) {
    this.sagaRepository = sagaRepository;
    this.unitOfWork = unitOfWork;
  }

  /**
   * Creates or resumes the cancel-event saga command safely.
   * Used in: Cancel Event Saga start
   * Triggered via: gRPC
   */
  async startCancelEventSaga({ eventId }: { eventId: string }) {
    if (!eventId) {
      throw new ValidationError("Event id is required");
    }

    const existingSaga = await this.sagaRepository.findByTypeAndReferenceId(
      "CANCEL_EVENT",
      eventId,
    );

    if (existingSaga && ["started", "in_progress", "completed"].includes(existingSaga.status)) {
      return {
        sagaId: existingSaga.id,
        status: existingSaga.status,
      };
    }

    if (existingSaga) {
      await this.unitOfWork.withTransaction(async (repos) => {
        await repos.sagaStepRepository.resetRetryableSteps(existingSaga.id);
        await repos.sagaRepository.update(
          { id: existingSaga.id },
          {
            status: "started",
            currentStep: null,
            errorMessage: null,
          },
        );

        await repos.outboxEventRepository.create({
          topic: "saga.cancel.event.requested",
          payload: {
            sagaId: existingSaga.id,
            eventId,
          },
          status: "PENDING",
        });
      });

      return {
        sagaId: existingSaga.id,
        status: "started",
      };
    }

    const createdSaga = await this.unitOfWork.withTransaction(async (repos) => {
      const saga = await repos.sagaRepository.create({
        sagaType: "CANCEL_EVENT",
        referenceId: eventId,
        status: "started",
        currentStep: null,
        steps: {
          create: [
            { stepName: "EVENT_SERVICE", stepOrder: 1, status: "pending" },
            { stepName: "PAYMENT_SERVICE", stepOrder: 2, status: "pending" },
            { stepName: "BOOKING_SERVICE", stepOrder: 3, status: "pending" },
            { stepName: "SEAT_SERVICE", stepOrder: 4, status: "pending" },
          ],
        },
      });

      await repos.outboxEventRepository.create({
        topic: "saga.cancel.event.requested",
        payload: {
          sagaId: saga.id,
          eventId,
        },
        status: "PENDING",
      });

      return saga;
    });

    return {
      sagaId: createdSaga.id,
      status: createdSaga.status,
    };
  }
}
