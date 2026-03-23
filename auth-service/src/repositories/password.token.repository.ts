import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaAdapter } from "../../../utils/src/IBase.repository";
import { BaseRepository } from "./base.repository";
import { IPasswordResetTokenRepository } from "../interface/IPassword.token.repository";

type TModel = Prisma.PasswordResetTokenGetPayload<Prisma.PasswordResetTokenFindUniqueArgs>;
type TCreate = Prisma.PasswordResetTokenCreateArgs["data"];
type TUpdate = Prisma.PasswordResetTokenUpdateArgs["data"];
type TWhere = Prisma.PasswordResetTokenWhereInput;
type TFindManyArgs = Prisma.PasswordResetTokenFindManyArgs;

export class PasswordResetTokenRepository
  extends BaseRepository<TModel, TCreate, TUpdate, TWhere, TFindManyArgs>
  implements IPasswordResetTokenRepository
{
  constructor({ prisma }: { prisma: PrismaClient | Prisma.TransactionClient }) {
    super(new PrismaAdapter(prisma.passwordResetToken));
  }
}
