-- CreateEnum
CREATE TYPE "enum_outbox_status" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "enum_saga_status" AS ENUM ('started', 'in_progress', 'compensating', 'completed', 'failed', 'compensated', 'timeout');

-- CreateEnum
CREATE TYPE "enum_step_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'compensating', 'compensated', 'skipped');

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "enum_outbox_status" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saga" (
    "id" UUID NOT NULL,
    "saga_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "status" "enum_saga_status" NOT NULL,
    "current_step" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SagaStep" (
    "id" UUID NOT NULL,
    "fk_saga_id" UUID NOT NULL,
    "step_name" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "status" "enum_step_status" NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SagaStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_status_idx" ON "outbox_events"("status");

-- CreateIndex
CREATE INDEX "outbox_events_created_at_idx" ON "outbox_events"("created_at");

-- CreateIndex
CREATE INDEX "saga_reference_id_idx" ON "saga"("reference_id");

-- CreateIndex
CREATE INDEX "saga_status_idx" ON "saga"("status");

-- CreateIndex
CREATE INDEX "saga_reference_id_saga_type_idx" ON "saga"("reference_id", "saga_type");

-- CreateIndex
CREATE INDEX "SagaStep_fk_saga_id_idx" ON "SagaStep"("fk_saga_id");

-- CreateIndex
CREATE UNIQUE INDEX "SagaStep_fk_saga_id_step_order_key" ON "SagaStep"("fk_saga_id", "step_order");

-- AddForeignKey
ALTER TABLE "SagaStep" ADD CONSTRAINT "SagaStep_fk_saga_id_fkey" FOREIGN KEY ("fk_saga_id") REFERENCES "saga"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
