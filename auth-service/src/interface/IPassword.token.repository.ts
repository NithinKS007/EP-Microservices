import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed PasswordResetToken domain model
 */
export type PasswordResetTokenModel =
  Prisma.PasswordResetTokenGetPayload<Prisma.PasswordResetTokenDefaultArgs>;

/**
 * Types for repository operations
 */
export type PasswordResetTokenCreateData = Prisma.PasswordResetTokenCreateInput;
export type PasswordResetTokenUpdateData = Prisma.PasswordResetTokenUpdateInput;
export type PasswordResetTokenWhere = Prisma.PasswordResetTokenWhereInput;

/**
 * PasswordResetToken Repository contract
 * Defines all supported persistence operations for PasswordResetToken entity
 */
export interface IPasswordResetTokenRepository extends DatabaseAdapter<
  PasswordResetTokenModel,
  PasswordResetTokenCreateData,
  PasswordResetTokenUpdateData,
  PasswordResetTokenWhere
> {
  findByTokenHash(tokenHash: string): Promise<PasswordResetTokenModel | null>;
}
