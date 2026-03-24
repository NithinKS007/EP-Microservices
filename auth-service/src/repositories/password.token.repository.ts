import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import {
  IPasswordResetTokenRepository,
  PasswordResetTokenModel,
} from "../interface/IPassword.token.repository";

type TModel = Prisma.PasswordResetTokenGetPayload<Prisma.PasswordResetTokenFindUniqueArgs>;
type TCreate = Prisma.PasswordResetTokenCreateArgs["data"];
type TUpdate = Prisma.PasswordResetTokenUpdateArgs["data"];
type TWhere = Prisma.PasswordResetTokenWhereInput;

export class PasswordResetTokenRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere>
  implements IPasswordResetTokenRepository
{
  private readonly prisma: PrismaClient | Prisma.TransactionClient;
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.passwordResetToken));
    this.prisma = prisma;
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenModel | null> {
    return await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
    });
  }
}
