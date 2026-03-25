-- CreateTable
CREATE TABLE "refreshTokens" (
    "id" UUID NOT NULL,
    "fk_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refreshTokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refreshTokens_token_hash_key" ON "refreshTokens"("token_hash");

-- CreateIndex
CREATE INDEX "refreshTokens_fk_user_id_idx" ON "refreshTokens"("fk_user_id");
