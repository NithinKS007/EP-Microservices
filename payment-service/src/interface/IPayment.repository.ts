import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed Payment domain model
 */
export type PaymentModel = Prisma.PaymentGetPayload<{}>;

/**
 * Types for repository operations
 */
export type PaymentCreateData = Prisma.PaymentCreateInput;
export type PaymentUpdateData = Prisma.PaymentUpdateInput;
export type PaymentWhere = Prisma.PaymentWhereInput;

/**
 * Payment Repository contract
 * Defines all supported persistence operations for Payment entity
 */
export interface IPaymentRepository extends DatabaseAdapter<
  PaymentModel,
  PaymentCreateData,
  PaymentUpdateData,
  PaymentWhere
> {
  updateManyPaymentsNotSuccess(paymentId: string): Promise<Prisma.BatchPayload>;
  updateManyPaymentsNotFailed(paymentId: string): Promise<Prisma.BatchPayload>;
  findByOrderId(orderId: string): Promise<PaymentModel | null>;
  findPaymentsByBookingIds(bookingIds: string[]): Promise<PaymentModel[]>;
  bulkRefundPayments(bookingIds: string[]): Promise<{ refundedCount: number; failedCount: number }>;
}
