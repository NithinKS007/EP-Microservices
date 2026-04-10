import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed SagaStep domain model
 */
export type SagaStepModel = Prisma.SagaStepGetPayload<Prisma.SagaStepDefaultArgs>;

/**
 * Types for repository operations
 */
export type SagaStepCreateData = Prisma.SagaStepCreateInput;
export type SagaStepUpdateData = Prisma.SagaStepUpdateInput;
export type SagaStepWhere = Prisma.SagaStepWhereInput;

/**
 * SagaStep Repository contract
 * Defines all supported persistence operations for SagaStep entity
 */
export interface ISagaStepRepository extends DatabaseAdapter<
  SagaStepModel,
  SagaStepCreateData,
  SagaStepUpdateData,
  SagaStepWhere
> {
  findBySagaId(sagaId: string): Promise<SagaStepModel[]>;
  resetRetryableSteps(sagaId: string): Promise<void>;
  resetAllSteps(sagaId: string): Promise<void>;
}
