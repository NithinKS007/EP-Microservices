import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed RefreshToken domain model
 */
export type RefreshTokenModel = Prisma.RefreshTokenGetPayload<Prisma.RefreshTokenDefaultArgs>;

/**
 * Types for repository operations
 */
export type RefreshTokenCreateData = Prisma.RefreshTokenCreateInput;
export type RefreshTokenUpdateData = Prisma.RefreshTokenUpdateInput;
export type RefreshTokenWhere = Prisma.RefreshTokenWhereInput;

/**
 * RefreshToken Repository contract
 * Defines all supported persistence operations for RefreshToken entity
 */
export interface IRefreshTokenRepository extends DatabaseAdapter<
  RefreshTokenModel,
  RefreshTokenCreateData,
  RefreshTokenUpdateData,
  RefreshTokenWhere
> {
  revokeAllByUserId(userId: string): Promise<void>;
  deleteOldTokens(userId: string, maxSessions: number): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenModel | null>;
  deleteExpiredTokens(): Promise<void>;
}
