import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed Saga domain model
 */
export type SagaModel = Prisma.SagaGetPayload<{}>;

/**
 * Types for repository operations
 */
export type SagaCreateData = Prisma.SagaCreateInput;
export type SagaUpdateData = Prisma.SagaUpdateInput;
export type SagaWhere = Prisma.SagaWhereInput;

/**
 * Saga Repository contract
 * Defines all supported persistence operations for Saga entity
 */
export interface ISagaRepository extends DatabaseAdapter<
  SagaModel,
  SagaCreateData,
  SagaUpdateData,
  SagaWhere
> {
  findByTypeAndReferenceId(sagaType: string, referenceId: string): Promise<SagaModel | null>;
}
