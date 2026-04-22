# 08 Concurrency And Data Integrity

This document explains how the system prevents data corruption, double-bookings, and lost messages under concurrent access.

## 1. Seat Conflict Prevention: Advisory Locks

### The Problem
Two users request the same seat at the same time. Without protection, both proceed through the "is this seat available?" check before either writes, causing a double-booking (**TOCTOU** — Time-of-Check-to-Time-of-Use).

### The Solution
The booking creation flow uses **PostgreSQL Advisory Locks** (`pg_advisory_xact_lock`) to serialize concurrent access to the same seats.

### How It Works

```
POST /api/v1/booking
  │
  ▼
Snapshot seat details via gRPC (event-service)
  │
  ▼
BEGIN TRANSACTION
  │
  ├─ 1. Sort seat IDs alphabetically
  │     (Prevents deadlocks — all concurrent transactions acquire locks in the same order)
  │
  ├─ 2. pg_advisory_xact_lock(hashtext(seatId + '_1'), hashtext(seatId + '_2'))
  │     (One lock per seat — transaction-scoped, auto-released on COMMIT/ROLLBACK)
  │
  ├─ 3. findActiveBookingsBySeatIds(seatIds)
  │     (Inside the locked critical section — safe from TOCTOU)
  │     Seats are "active" if:
  │       • Booked by a CONFIRMED booking (always active, no expiry check)
  │       • Booked by a PENDING/PAYMENT_INITIATED booking that has NOT expired
  │     Seats are NOT "active" if:
  │       • Booking is CANCELLED or EXPIRED
  │       • Booking is PENDING/PAYMENT_INITIATED but expiresAt < now
  │
  ├─ 4. If conflicts found → throw ConflictError (transaction aborts, locks released)
  │
  └─ 5. Create Booking + BookingSeat rows → COMMIT (locks released)
```

### Key Design Decisions

| Decision | Rationale |
| --- | --- |
| Advisory locks instead of `SELECT FOR UPDATE` | Advisory locks don't require existing rows — they work with arbitrary hash keys. This allows locking on seat IDs before the booking row even exists. |
| Sorted lock acquisition | Prevents deadlock when two transactions try to lock seats `[A, B]` and `[B, A]` simultaneously. |
| Transaction-scoped locks | `pg_advisory_xact_lock` auto-releases on commit/rollback, so hung transactions don't permanently hold locks. |
| 30-second transaction timeout | Prisma `$transaction({ timeout: 30000 })` prevents advisory lock starvation. |

### Source Files
- Lock acquisition: `booking-service/src/repositories/booking.repository.ts` → `acquireAdvisoryLocks()`
- Conflict detection: `booking-service/src/repositories/booking.repository.ts` → `findActiveBookingsBySeatIds()`
- Flow orchestration: `booking-service/src/services/booking.service.ts` → `create()`

## 2. Idempotency Protections

Every critical write operation in the system is designed to be safely retried.

### Booking Creation
- Client can pass an `idempotencyKey` header.
- If a booking with that key already exists, it is returned immediately without creating a duplicate.
- Source: `booking.service.ts` → `create()` lines 65-70.

### Payment Webhook Processing
- Before processing, checks if payment is already in a terminal state (`SUCCESS`, `FAILED`, `REFUNDED`).
- If payment is already `SUCCESS` and a new success webhook arrives → returns the existing payment.
- If payment is already `FAILED` and a success webhook arrives → records the receipt, then auto-triggers refund (money is never stuck).
- Source: `payment.service.ts` → `handleCapturedPayment()`.

### Saga Start
- **INITIATE_PAYMENT:** Checks for existing saga. If status is `completed`, returns cached result. If `in_progress`, returns that the saga is running.
- **CANCEL_EVENT:** Checks for existing saga by type and referenceId (eventId). If found in `started/in_progress/completed`, returns the existing saga.
- Source: `saga.service.ts` → `startCancelEventSaga()`, `executeInitiatePaymentSaga()`.

### Seat Operations
- `confirmSeats()` checks `affectedCount`. If 0, verifies the seats are already SOLD for this booking and returns success (idempotent).
- `releaseSeats()` only releases seats in `LOCKED` state — already-released seats are unaffected.
- `bulkReleaseSeats()` releases both `LOCKED` and `SOLD` seats — used during event cancellation and refunds.

### Booking Status Updates
- Attempting to set a booking to its current status returns the booking without error.
- Terminal states (`CONFIRMED`, `CANCELLED`, `EXPIRED`) are silently returned without mutation.

## 3. The Outbox Pattern (Deep Dive)

### Why Not Just Publish to Kafka Directly?

If you do this:
```
// WRONG: Dual-write problem
await db.payment.update({ status: "SUCCESS" });
await kafka.publish("payment.success", payload);  // ← What if this fails?
```

If Kafka is down when you try to publish, the payment is marked `SUCCESS` in the database but no event is ever sent. The booking will never be confirmed, and the seats will be stuck in `LOCKED` forever.

### How Outbox Solves This

```
// CORRECT: Transactional Outbox
await db.$transaction([
  db.payment.update({ status: "SUCCESS" }),
  db.outboxEvent.create({ topic: "payment.success", payload: {...} })
]);
// Both writes succeed or both fail — no inconsistency possible
```

A background `OutboxWorker` polls the outbox table and publishes pending events to Kafka. If Kafka is down, it retries with exponential backoff.

### Outbox Worker Details

| Config | Value | Purpose |
| --- | --- | --- |
| Poll interval | 5 seconds | How often the worker checks for pending events |
| Batch size | 50 | Max events processed per poll cycle |
| Fetch strategy | `FOR UPDATE SKIP LOCKED` | Prevents multiple worker instances from competing on the same rows |
| Max retries | 5 | Number of publish attempts before marking as `FAILED` |
| Backoff | `2^n × 1s` (max 60s) + random jitter | Prevents synchronized retry storms |
| Terminal state | `FAILED` | After 5 retries, event is permanently marked for manual review |

### Outbox Event Lifecycle
```
PENDING → (worker picks up) → SENT
PENDING → (publish fails) → retry with backoff → PENDING (retryCount incremented)
PENDING → (5 retries exhausted) → FAILED
```

### Services Using Outbox
- **payment-service:** `payment.success`, `payment.failed`, `payment.refunded`
- **saga-orchestrator-service:** `saga.cancel.event.requested`, `saga.cancel.event.completed`, `saga.cancel.event.failed`

## 4. Dead Letter Queue (DLQ) Strategy

When a Kafka consumer exhausts its retry budget, the message is published to a Dead Letter Queue topic.

### How It Works
1. Consumer handler throws an error.
2. Retry loop attempts up to 3 times with exponential backoff (2s, 4s, 8s).
3. After 3 failures, the original message + error details are published to the corresponding DLQ topic.
4. If the DLQ publish itself fails, the error is **re-thrown** — this prevents Kafka from committing the offset, causing the original message to be redelivered by the broker.

### DLQ Message Format
```json
{
  "originalPayload": { "bookingId": "...", "paymentId": "...", "eventId": "..." },
  "error": "Error message string",
  "stack": "Full stack trace",
  "failedAt": "2026-04-20T12:00:00.000Z",
  "retryCount": 3
}
```

### DLQ Topics
| DLQ Topic | Source Topic | Service |
| --- | --- | --- |
| `payment.success.dlq` | `payment.success` | payment-service |
| `payment.failed.dlq` | `payment.failed` | payment-service |
| `payment.refunded.dlq` | `payment.refunded` | payment-service |
| `saga.cancel.event.dlq` | `saga.cancel.event.requested` | saga-orchestrator-service |

### How to Handle DLQ Messages
1. Inspect the DLQ topic using Kafka UI (`http://localhost:8080`).
2. Review the `error` and `stack` fields to identify the root cause.
3. Fix the underlying issue (service was down, data corruption, etc.).
4. Replay the message by publishing the `originalPayload` back to the source topic.

## 5. Edge Cases Handled

### Late Payment Success After Failure
**Scenario:** User's payment fails in the Razorpay modal, triggering `payment.failed`. Then, the actual bank charge succeeds and Razorpay sends a `payment.captured` webhook.

**Handling:** The webhook handler detects the payment is already `FAILED`, records the successful receipt, and automatically triggers a refund. Money is never stuck.

### Booking Expiry Race with Payment Webhook
**Scenario:** The expiry cron marks a booking as `EXPIRED` at the exact moment a `payment.success` webhook arrives.

**Handling:** The `updateBookingStatus(CONFIRMED)` call silently returns the existing `EXPIRED` state. The `confirmSeats` call fails (no locked seats left, `affectedCount = 0`). The consumer retries and eventually goes to DLQ. The auto-refund mechanism handles the financial side.

### Concurrent Saga Prevention
**Scenario:** Two admin users simultaneously trigger cancel for the same event.

**Handling:** The `startCancelEventSaga` method checks for existing sagas by `(sagaType, referenceId)`. If one exists in `started/in_progress/completed`, it returns the existing saga instead of creating a duplicate.
