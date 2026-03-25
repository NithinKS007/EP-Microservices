-- AlterTable
ALTER TABLE "refreshTokens" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- CreateIndex
CREATE INDEX "refreshTokens_expires_at_idx" ON "refreshTokens"("expires_at");

-- CreateIndex
CREATE INDEX "refreshTokens_fk_user_id_revoked_idx" ON "refreshTokens"("fk_user_id", "revoked");
