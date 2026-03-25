import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IUserRepository, UserModel } from "./../interface/IUser.repository";

type TModel = Prisma.UserGetPayload<Prisma.UserFindUniqueArgs>;
type TCreate = Prisma.UserCreateArgs["data"];
type TUpdate = Prisma.UserUpdateArgs["data"];
type TWhere = Prisma.UserWhereInput;

export class UserRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
  implements IUserRepository
{
  private readonly prisma: PrismaClient | Prisma.TransactionClient;
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.user));
    this.prisma = prisma
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    return await this.prisma.user.findFirst({
      where: { email },
    });
  }
}
