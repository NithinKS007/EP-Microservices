# 03 Business Workflows

This document describes the complex, multi-service workflows operating in the background.

## 1. Active Recovery: Cron Jobs

Because distributed systems fail, background jobs sweep for stuck state.

### Booking Expiry Job (Every Minute)
*Goal: Ensure unpaid bookings don't permanently hoard seats.*
1. `booking-service` scans for `PENDING` or `PAYMENT_INITIATED` bookings older than their `expiresAt` timestamp (20 minutes).
2. It loops through them and executes a **Synchronous gRPC call** to `event-service.bulkReleaseSeats()`.
3. It updates the booking statuses to `EXPIRED` in bulk.

### Saga Recovery Job (Every 5 Minutes)
*Goal: Ensure Sagas that crashed mid-execution eventually finish.*
1. `saga-orchestrator-service` looks for orchestrations stuck in `started` or `in_progress` for more than 10 minutes.
2. It pushes a fresh `saga.cancel.event.requested` Kafka event back into its own Outbox table.
3. The outbox worker publishes it, forcing the `CancelEventSagaConsumer` to pick it up and re-run. Since Sagas are inherently idempotent, repeating a step is perfectly safe and ensures the Saga ultimately completes or fails gracefully.

## 2. Distributed Transactions: Sagas

When a transaction needs to hit multiple databases, we use the Saga pattern. 

### Flow A: Payment Initiation Saga
Triggered when a user tries to pay. This MUST be completed immediately so the user can be shown the Razorpay checkout portal. Thus, the orchestration coordinates via rapid, synchronous gRPC calls.

1. **Start:** `payment-service` passes control to `saga-orchestrator-service`.
2. **Execution Steps:**
   - Confirm booking exists (`booking-service`).
   - `lockSeats` (`event-service`).
   - `updateBookingStatus` to INITIATED (`booking-service`).
   - `createPayment` and generate Razorpay Order (`payment-service`).
3. **Completion:** Returns the Razorpay Order ID to the user.
4. **Compensation (Rollback):** If Step 4 crashes, the Saga catches the error and executes its rollback sequence: Revert booking to PENDING, release seats in event-service. 

### Flow B: Cancel Event Saga
Triggered when an admin deletes an Event. This is a massive operation. It must run Asynchronously via Kafka to prevent timeouts.

1. **Start:** `event-service` pushes command to Outbox.
2. **Consume:** `CancelEventSagaConsumer` parses the request.
3. **Execution Steps:**
   - `markEventCancelled` (`event-service`).
   - Fetch all affected bookings.
   - Loop and `bulkRefundPayments` (`payment-service`).
   - `bulkCancelBookings` (`booking-service`).
   - `bulkReleaseSeats` (`event-service`).
4. **Completion:** Writes `saga.cancel.event.completed` to the outbox (Observability/Logging).
5. **Compensation (Rollback):** Since an admin cannot "rollback" an event cancellation, if a step exhausts its max retries, the Saga permanently marks `saga.cancel.event.failed` and goes to a Dead Letter Queue (DLQ) for manual developer intervention.

## 3. Asynchronous Settlement: The Outbox Pattern

To prevent issues where our database updates but the Kafka event is lost (due to network drops), we use the Transactional Outbox pattern.

1. **Transaction:** Instead of just saving `Payment.status = SUCCESS`, we open a DB transaction. We save the Payment update AND insert a JSON payload into the `OutboxEvent` table. Both succeed, or both fail.
2. **Worker:** A polling mechanism (`OutboxWorker`) reads from the table.
3. **Publish:** It pushes the payload to Kafka.
4. **Mark Sent:** It updates the local table row to `SENT`. If it fails, it uses exponential backoff to retry.
