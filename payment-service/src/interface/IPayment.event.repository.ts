import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed PaymentEvent domain model
 */
export type PaymentEventModel = Prisma.PaymentEventGetPayload<{}>;

/**
 * Types for repository operations
 */
type Base = Prisma.PaymentEventCreateInput;

export type PaymentEventCreateData = {
  type: Base["type"];
  payload: Base["payload"];
  paymentId?: string|null;
};
// export type PaymentEventCreateData = Prisma.PaymentEventCreateInput;
export type PaymentEventUpdateData = Prisma.PaymentEventUpdateInput;
export type PaymentEventWhere = Prisma.PaymentEventWhereInput;

/**
 * PaymentEvent Repository contract
 * Defines all supported persistence operations for PaymentEvent entity
 */
export interface IPaymentEventRepository extends DatabaseAdapter<
  PaymentEventModel,
  PaymentEventCreateData,
  PaymentEventUpdateData,
  PaymentEventWhere
> {}
