-- CreateEnum
CREATE TYPE "enum_booking_status" AS ENUM ('PENDING', 'PAYMENT_INITIATED', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "enum_outbox_status" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "booking" (
    "id" UUID NOT NULL,
    "fk_users_id" UUID NOT NULL,
    "fk_event_id" UUID NOT NULL,
    "status" "enum_booking_status" NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookingSeat" (
    "id" UUID NOT NULL,
    "fk_booking_id" UUID NOT NULL,
    "fk_seat_id" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookingSeat_pkey" PRIMARY KEY ("id")
);

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

-- CreateIndex
CREATE UNIQUE INDEX "booking_idempotencyKey_key" ON "booking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "booking_fk_users_id_idx" ON "booking"("fk_users_id");

-- CreateIndex
CREATE INDEX "booking_fk_event_id_idx" ON "booking"("fk_event_id");

-- CreateIndex
CREATE INDEX "booking_status_expires_at_idx" ON "booking"("status", "expires_at");

-- CreateIndex
CREATE INDEX "bookingSeat_fk_booking_id_idx" ON "bookingSeat"("fk_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookingSeat_fk_seat_id_key" ON "bookingSeat"("fk_seat_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_idx" ON "outbox_events"("status");

-- CreateIndex
CREATE INDEX "outbox_events_created_at_idx" ON "outbox_events"("created_at");

-- AddForeignKey
ALTER TABLE "bookingSeat" ADD CONSTRAINT "bookingSeat_fk_booking_id_fkey" FOREIGN KEY ("fk_booking_id") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
