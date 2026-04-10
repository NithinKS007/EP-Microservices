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
    this.prisma = prisma;
  }

  async findByEmail(email: string): Promise<UserModel | null> {
    return await this.prisma.user.findFirst({
      where: { email },
    });
  }

  async findUsersWithPagination(dto: {
    limit: number;
    page: number;
  }): Promise<{ data:Omit<UserModel, "password">[]; meta: { total: number; page: number; limit: number } }> {
    const { limit, page } = dto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        where: {
          NOT: {
            role: {
              equals: "ADMIN",
            },
          },
        },
        omit: {
          password: true,
        },
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      this.prisma.user.count({}),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }
}
