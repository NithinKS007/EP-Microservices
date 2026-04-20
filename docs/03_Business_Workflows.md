# 03 Business Workflows

This document describes the complex, multi-service workflows operating in the background.

## 1. Active Recovery: Cron Jobs

Because distributed systems fail, background jobs sweep for stuck state.

### Booking Expiry Job (Every Minute)
*Goal: Ensure unpaid bookings don't permanently hoard seats.*

1. `booking-service` scans for `PENDING` or `PAYMENT_INITIATED` bookings past their `expiresAt` timestamp (20 minutes from creation), **limited to 100 per cycle** to prevent memory pressure.
2. For each expired booking, it executes **Synchronous gRPC calls**:
   - `event-service.bulkReleaseSeats()` — releases any locked seats back to `AVAILABLE`.
   - `payment-service.bulkFailPayments()` — marks any associated `INITIATED` payments as `FAILED`.
3. Updates all processed booking statuses to `EXPIRED` in a single bulk database update.
4. If a gRPC call fails (e.g., event-service is down), the circuit breaker prevents cascading failures. The booking will be picked up again on the next cron cycle.

### Saga Recovery Job (Every 5 Minutes)
*Goal: Ensure Sagas that crashed mid-execution eventually finish.*

1. `saga-orchestrator-service` looks for orchestrations stuck in `started` or `in_progress` for more than 10 minutes.
2. For each abandoned saga:
   - **CANCEL_EVENT type:** Pushes a fresh `saga.cancel.event.requested` event into its own Outbox table. The outbox worker publishes it, forcing the `CancelEventSagaConsumer` to pick it up and re-run. Since each saga step checks if it has already been `completed` or `skipped`, repeating a step is perfectly safe.
   - **Sync saga types (like INITIATE_PAYMENT):** Cannot be auto-resumed because they lack a persistent consumer. These are marked `failed` with an error message for manual review.
3. Bumps `updatedAt` on the saga so it won't be picked up again until it has been stuck for another 10 minutes.

## 2. Distributed Transactions: Sagas

When a transaction needs to hit multiple databases, we use the Saga pattern.

### Flow A: Payment Initiation Saga (Synchronous)
Triggered when a user tries to pay. This MUST be completed immediately so the user can be shown the Razorpay checkout portal. Thus, the orchestration coordinates via rapid, synchronous gRPC calls.

1. **Start:** `payment-service` passes control to `saga-orchestrator-service` via gRPC.
2. **Idempotency:** If a saga already exists for this booking in `started/in_progress/completed` state, the existing result is returned.
3. **Execution Steps:**
   - **Step 1 — BOOKING_SERVICE:** Confirm booking exists, belongs to user, is not expired, and is in a valid state (`PENDING`). Fetch seat IDs.
   - **Step 2 — SEAT_SERVICE:** Lock seats in `event-service` via gRPC. Sets `seatStatus = LOCKED`, `lockedByBookingId`, and `lockExpiresAt`.
   - **Step 3 — BOOKING_STATUS_SERVICE:** Update booking to `PAYMENT_INITIATED` via gRPC.
   - **Step 4 — PAYMENT_SERVICE:** Create Payment record and generate a Razorpay Order via external API (protected by `externalWrite` circuit breaker).
4. **Completion:** Returns the Razorpay Order ID, amount, and key to the user.
5. **Compensation (Rollback):** If any step fails, the Saga catches the error and executes its rollback sequence:
   - If booking was marked `PAYMENT_INITIATED` → revert to `PENDING`.
   - If seats were locked → release them back to `AVAILABLE`.
   - The compensation only runs for steps that **actually executed** (tracked via `seatsLocked` and `bookingMarkedInitiated` flags).

### Flow B: Cancel Event Saga (Asynchronous)
Triggered when an admin cancels an Event. This is a massive operation affecting potentially thousands of bookings. It must run asynchronously via Kafka to prevent timeouts.

1. **Start:** `event-service` calls `saga-orchestrator-service` via gRPC to create the saga.
2. **Outbox:** Saga orchestrator creates a `Saga` + `SagaStep` records and inserts a `saga.cancel.event.requested` event into its Outbox table (atomically in one transaction).
3. **Consume:** `CancelEventSagaConsumer` picks up the command from Kafka.
4. **Execution Steps** (each step retries up to **3 times** with exponential backoff):
   - **Step 1 — EVENT_SERVICE:** `markEventCancelled` via gRPC — sets event status to `CANCELLED`.
   - **Fetch bookings:** Paginated lookup of all affected bookings in **batches of 500** to prevent OOM.
   - If **no bookings** exist, the remaining 3 steps are marked `skipped` and the saga completes.
   - **Step 2 — PAYMENT_SERVICE:** `bulkRefundPayments` via gRPC — calls Razorpay refund API for each `SUCCESS` payment. Already-refunded payments are idempotently skipped.
   - **Step 3 — BOOKING_SERVICE:** `bulkCancelBookings` via gRPC — marks all bookings as `CANCELLED`.
   - **Step 4 — SEAT_SERVICE:** `bulkReleaseSeats` via gRPC — releases all `LOCKED` and `SOLD` seats back to `AVAILABLE`.
5. **Completion:** Writes `saga.cancel.event.completed` to the outbox for observability.
6. **Failure Handling:** If a step exhausts its 3 retries:
   - The step and saga are marked `failed` with the error message.
   - `saga.cancel.event.failed` is published to the outbox.
   - The entire message is sent to the **Dead Letter Queue** (`saga.cancel.event.dlq`) for developer intervention.

## 3. Asynchronous Settlement: The Outbox Pattern

To prevent issues where our database updates but the Kafka event is lost (due to network drops), we use the Transactional Outbox pattern.

### How It Works
1. **Transaction:** Instead of just saving `Payment.status = SUCCESS`, we open a DB transaction. We save the Payment update AND insert a JSON payload into the `OutboxEvent` table. Both succeed, or both fail. This eliminates the dual-write problem.
2. **Worker:** An `OutboxWorker` polls the table every 5 seconds.
3. **Fetch:** Uses `SELECT ... FOR UPDATE SKIP LOCKED` to claim a batch of up to **50 events** for processing. The `SKIP LOCKED` clause means multiple worker instances (if scaled horizontally) won't fight over the same rows.
4. **Publish:** Pushes each event payload to Kafka using the idempotent producer (`acks: -1`).
5. **Mark Sent:** Updates all successfully published events to `SENT` with a `processedAt` timestamp.
6. **Retry on failure:** Uses exponential backoff with jitter (`2^n × 1s`, capped at 60s). After **5 retries**, the event is permanently marked `FAILED` for manual investigation.

### Where Outbox Is Used
| Service | Topics Published |
| --- | --- |
| `payment-service` | `payment.success`, `payment.failed`, `payment.refunded` |
| `saga-orchestrator-service` | `saga.cancel.event.requested`, `saga.cancel.event.completed`, `saga.cancel.event.failed` |

## 4. Payment Settlement via Kafka Consumers

After the outbox worker publishes events to Kafka, consumers handle the downstream state changes.

### PaymentEventConsumer (payment-service)
Consumes `payment.success`, `payment.failed`, and `payment.refunded` topics.

**On `payment.success`:**
1. Updates booking status to `CONFIRMED` via gRPC to booking-service.
2. Confirms seats (LOCKED → SOLD) via gRPC to event-service.

**On `payment.failed`:**
1. Updates booking status to `CANCELLED` via gRPC to booking-service.
2. Releases seats (LOCKED → AVAILABLE) via gRPC to event-service.

**On `payment.refunded`:**
1. Updates booking status to `CANCELLED` via gRPC to booking-service.
2. Bulk releases seats (including SOLD seats) via gRPC to event-service.

**Retry strategy:** Each consumer handler retries up to 3 times with exponential backoff (2s, 4s, 8s). If all retries fail, the message is published to the corresponding DLQ topic (e.g., `payment.success.dlq`). If the DLQ publish itself fails, the error is re-thrown to prevent Kafka from committing the offset, causing the original message to be redelivered.
