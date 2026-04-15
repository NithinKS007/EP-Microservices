-- CreateIndex
CREATE INDEX "seats_fk_event_id_seatStatus_idx" ON "seats"("fk_event_id", "seatStatus");

-- CreateIndex
CREATE INDEX "seats_locked_by_booking_id_seatStatus_idx" ON "seats"("locked_by_booking_id", "seatStatus");
