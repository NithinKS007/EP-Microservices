import { ISagaRepository } from "interface/ISaga.repository";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../utils/src/error.handling.middleware";
import { ISagaStepRepository } from "interface/ISaga.step.repository";

export class SagaService {
  private readonly sagaRepository: ISagaRepository;
  private readonly sagaStepRepository: ISagaStepRepository;

  constructor({
    sagaRepository,
    sagaStepRepository,
  }: {
    sagaRepository: ISagaRepository;
    sagaStepRepository: ISagaStepRepository;
  }) {
    this.sagaRepository = sagaRepository;
    this.sagaStepRepository = sagaStepRepository;
  }
}
