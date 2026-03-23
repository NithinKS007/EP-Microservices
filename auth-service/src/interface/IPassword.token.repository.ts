import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed PasswordResetToken domain model
 */
export type PasswordResetTokenModel = Prisma.PasswordResetTokenGetPayload<{}>;

/**
 * Types for repository operations
 */
export type PasswordResetTokenCreateData = Prisma.PasswordResetTokenCreateInput;
export type PasswordResetTokenUpdateData = Prisma.PasswordResetTokenUpdateInput;
export type PasswordResetTokenWhere = Prisma.PasswordResetTokenWhereInput;
export type PasswordResetTokenFindManyArgs = Prisma.PasswordResetTokenFindManyArgs;

/**
 * PasswordResetToken Repository contract
 * Defines all supported persistence operations for PasswordResetToken entity
 */
export interface IPasswordResetTokenRepository extends DatabaseAdapter<
  PasswordResetTokenModel,
  PasswordResetTokenCreateData,
  PasswordResetTokenUpdateData,
  PasswordResetTokenWhere,
  PasswordResetTokenFindManyArgs
> {}
