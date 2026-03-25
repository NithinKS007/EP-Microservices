import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IRefreshTokenRepository } from "../interface/IRefresh.token.repository";

type TModel = Prisma.RefreshTokenGetPayload<Prisma.RefreshTokenFindUniqueArgs>;
type TCreate = Prisma.RefreshTokenCreateArgs["data"];
type TUpdate = Prisma.RefreshTokenUpdateArgs["data"];
type TWhere = Prisma.RefreshTokenWhereInput;

export class RefreshTokenRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
  implements IRefreshTokenRepository
{
  private readonly prisma: PrismaClient | Prisma.TransactionClient;
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.refreshToken));
    this.prisma = prisma;
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }

  async deleteOldTokens(userId: string, maxSessions: number) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revoked: false },
      orderBy: { createdAt: "desc" },
      skip: maxSessions, // keep latest N
    });

    const ids = tokens.map((t) => t.id);

    if (ids.length > 0) {
      await this.prisma.refreshToken.updateMany({
        where: { id: { in: ids } },
        data: { revoked: true },
      });
    }
  }

  async findByTokenHash(tokenHash: string) {
    return await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });
  }

  async deleteExpiredTokens() {
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
