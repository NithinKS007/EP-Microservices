import { Request, Response, NextFunction } from "express";
import { SagaService } from "../services/saga.service";
import { SagaRecoveryJob } from "../utils/saga.recovery.job";
import { sendResponse, StatusCodes, validateDto } from "../../../utils/src";
import { FindSagaStatusQueryDto } from "./../dtos/saga.dtos";

export class SagaController {
  private sagaService: SagaService;
  private sagaRecoveryJob: SagaRecoveryJob;

  constructor({
    sagaService,
    sagaRecoveryJob,
  }: {
    sagaService: SagaService;
    sagaRecoveryJob: SagaRecoveryJob;
  }) {
    this.sagaService = sagaService;
    this.sagaRecoveryJob = sagaRecoveryJob;
  }

  /**
   * GET /api/v1/sagas/:id/status
   * Returns high-level status of the saga (fast).
   */
  async findSagaStatus(req: Request, res: Response): Promise<void> {
    const dto = await validateDto(FindSagaStatusQueryDto, { id: req.params.id });
    const status = await this.sagaService.findSagaStatus(dto.id);
    sendResponse(res, StatusCodes.OK, status, "Saga fetched successfully");
  }

  /**
   * GET /api/v1/sagas/:id
   * Returns detailed saga state including individual steps (for debugging/advanced UI).
   */
  async findSagaDetails(req: Request, res: Response): Promise<void> {
    const dto = await validateDto(FindSagaStatusQueryDto, { id: req.params.id });
    const details = await this.sagaService.findSagaWithSteps(dto.id);
    sendResponse(res, StatusCodes.OK, details, "Saga fetched successfully");
  }

  /**
   * POST /api/v1/sagas/recovery
   * Admin endpoint to manually trigger the recovery job immediately.
   */
  async triggerRecovery(req: Request, res: Response) {
    await this.sagaRecoveryJob.recoverAbandonedSagas();
    sendResponse(res, StatusCodes.OK, null, "Recovery triggered");
  }
}
