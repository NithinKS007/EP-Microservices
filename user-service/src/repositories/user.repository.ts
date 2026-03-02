import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IUserRepository } from "./../interface/IUser.repository";

type TModel = Prisma.UserGetPayload<Prisma.UserFindUniqueArgs>;
type TCreate = Prisma.UserCreateArgs["data"];
type TUpdate = Prisma.UserUpdateArgs["data"];
type TWhere = Prisma.UserWhereInput;
type TFindManyArgs = Prisma.UserFindManyArgs;

export class UserRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IUserRepository
{
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.user));
  }
}
