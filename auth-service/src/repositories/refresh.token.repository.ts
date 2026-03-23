import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IRefreshTokenRepository } from "../interface/IRefresh.token.repository";

type TModel = Prisma.RefreshTokenGetPayload<Prisma.RefreshTokenFindUniqueArgs>;
type TCreate = Prisma.RefreshTokenCreateArgs["data"];
type TUpdate = Prisma.RefreshTokenUpdateArgs["data"];
type TWhere = Prisma.RefreshTokenWhereInput;
type TFindManyArgs = Prisma.RefreshTokenFindManyArgs;

export class RefreshTokenRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IRefreshTokenRepository
{
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.refreshToken));
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.adapter.updateMany({ userId }, { revoked: true });
  }

  async deleteOldTokens(userId: string, maxSessions: number) {
    const tokens = await this.findMany({
      where: { userId, revoked: false },
      orderBy: { createdAt: "desc" },
      skip: maxSessions, // keep latest N
    });

    const ids = tokens.map((t) => t.id);

    if (ids.length > 0) {
      await this.adapter.updateMany({ id: { in: ids } }, { revoked: true });
    }
  }
}
