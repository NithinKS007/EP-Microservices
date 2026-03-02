import { Prisma } from "../generated/prisma/client";
import { DatabaseAdapter } from "../../../utils/src/IBase.repository";

/**
 * Prisma-backed User domain model
 */
export type UserModel = Prisma.UserGetPayload<{}>;

/**
 * Types for repository operations
 */
export type UserCreateData = Prisma.UserCreateInput;
export type UserUpdateData = Prisma.UserUpdateInput;
export type UserWhere = Prisma.UserWhereInput;
export type UserFindManyArgs = Prisma.UserFindManyArgs;

/**
 * User Repository contract
 * Defines all supported persistence operations for User entity
 */
export interface IUserRepository extends DatabaseAdapter<
  UserModel,
  UserCreateData,
  UserUpdateData,
  UserWhere,
  UserFindManyArgs
> {}
