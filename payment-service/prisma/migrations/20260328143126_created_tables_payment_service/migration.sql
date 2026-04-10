-- DropForeignKey
ALTER TABLE "payment_events" DROP CONSTRAINT "payment_events_fk_payment_id_fkey";

-- AlterTable
ALTER TABLE "payment_events" ALTER COLUMN "fk_payment_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_fk_payment_id_fkey" FOREIGN KEY ("fk_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
