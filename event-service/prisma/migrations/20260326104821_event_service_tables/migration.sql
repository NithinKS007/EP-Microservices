-- CreateEnum
CREATE TYPE "enum_event_status" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "enum_seat_status" AS ENUM ('AVAILABLE', 'LOCKED', 'SOLD');

-- CreateEnum
CREATE TYPE "enum_seat_tier" AS ENUM ('VIP', 'REGULAR', 'ECONOMY');

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "venue_name" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "status" "enum_event_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" UUID NOT NULL,
    "fk_event_id" UUID NOT NULL,
    "seat_number" TEXT NOT NULL,
    "seatTier" "enum_seat_tier" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "seatStatus" "enum_seat_status" NOT NULL DEFAULT 'AVAILABLE',
    "locked_by_booking_id" UUID,
    "lock_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_name_venue_name_event_date_key" ON "events"("name", "venue_name", "event_date");

-- CreateIndex
CREATE INDEX "seats_fk_event_id_idx" ON "seats"("fk_event_id");

-- CreateIndex
CREATE INDEX "seats_seatStatus_idx" ON "seats"("seatStatus");

-- CreateIndex
CREATE INDEX "seats_locked_by_booking_id_idx" ON "seats"("locked_by_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "seats_fk_event_id_seat_number_key" ON "seats"("fk_event_id", "seat_number");

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_fk_event_id_fkey" FOREIGN KEY ("fk_event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
