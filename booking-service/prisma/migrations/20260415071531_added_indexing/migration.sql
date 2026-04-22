-- CreateIndex
CREATE INDEX "booking_fk_event_id_status_idx" ON "booking"("fk_event_id", "status");
