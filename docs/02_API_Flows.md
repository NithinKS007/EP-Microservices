# 02 API Flows

This document details the exact sequence of events when key REST APIs are invoked.

## Generic Request Path

1. Client calls API gateway (`http://localhost:3000`).
2. Gateway authenticates the JWT (if protected) and proxies to the upstream service.
3. Target service controllers validate DTOs.
4. Services execute local database transactions or rely on gRPC for foreign data.
5. Response returns through gateway.

## Booking APIs

### `POST /api/v1/booking`
Creates a brand new booking with concurrency-safe seat reservation.

**Flow:**
1. Validates the incoming DTO (`eventId`, `seats`, `totalAmount`, `userId`).
2. If an `idempotencyKey` is provided and a matching booking exists, returns the existing booking immediately (prevents duplicate bookings on retry).
3. Snapshots seat details from `event-service` via gRPC (`FindEventsByIdsWithSeats`), fetching only the specific seat IDs requested.
4. Opens a database transaction:
   - **Acquires advisory locks** (`pg_advisory_xact_lock`) on all requested seat IDs (sorted to prevent deadlocks).
   - **Checks for active booking conflicts** inside the locked critical section — queries for any seats that are already booked by a `CONFIRMED` booking, or by a `PENDING`/`PAYMENT_INITIATED` booking that has not yet expired.
   - If conflicts exist, the transaction is aborted with a `ConflictError` listing the conflicting seats.
   - Creates the `Booking` record with `status = PENDING` and a 20-minute `expiresAt` timestamp.
   - Creates `BookingSeat[]` rows with snapshotted `seatNumber` and `seatTier` (immutable record of what the user booked).
5. Returns the booking to the user.

*Note: This endpoint does NOT lock the seats in `event-service` yet. Seat locking is intentionally delayed until Payment Initiation to prevent holding seats for users who abandon checkout. The advisory lock only prevents concurrent conflicting bookings.*

### `GET /api/v1/booking` & `GET /api/v1/booking/:id`
Retrieves booking details with cross-service enrichment.

**Flow:**
1. Reads local `Booking` data with server-side pagination (`page` and `limit` parameters).
2. In parallel:
   - Calls `event-service` via gRPC (`FindEventsByIdsWithSeats`) for event metadata and seat details (paginated).
   - Calls `payment-service` via gRPC (`findPaymentsByBookingIds`) for payment status.
3. Merges the enrichment data into the response. If a gRPC call fails (circuit breaker open), the corresponding fields are returned as `null` rather than failing the entire request.

### Manual State Overrides: Confirm, Cancel, Expire

These are explicit recovery/admin endpoints to manually override states.
They use **Synchronous gRPC** to alter the seat inventory immediately.
*Why Synchronous?* Because these operations are heavily dependent on state. A user expects a 200 OK for a cancellation to mean "my seats are absolutely released."

**`POST /api/v1/booking/:id/confirm`**
1. Validates booking exists and belongs to the requesting user.
2. Validates payment status is `SUCCESS` via gRPC to `payment-service`.
3. gRPC call to `eventServiceGrpcClient.confirmSeats` (blocks until seats are mutated to `SOLD`).
4. Updates Booking to `CONFIRMED`.

**`POST /api/v1/booking/:id/cancel`**
1. Validates booking exists and is in a cancellable state.
2. If booking was paid, validates refund was processed.
3. gRPC call to `eventServiceGrpcClient.bulkReleaseSeats` (blocks until seats are `AVAILABLE`).
4. Updates Booking to `CANCELLED`.

**`POST /api/v1/booking/:id/expire`**
1. Validates booking is in `PENDING` or `PAYMENT_INITIATED` state.
2. gRPC call to `eventServiceGrpcClient.bulkReleaseSeats`.
3. Updates Booking to `EXPIRED`.

## Payment APIs

### `POST /api/v1/payment/:bookingId/initiate`
**Delegates to Saga Orchestrator.**
1. Hits `payment-service`.
2. Checks if a payment already exists for this booking (idempotency):
   - If payment is already `SUCCESS`, returns the existing payment.
   - If payment is `INITIATED`, returns cached Razorpay order details.
3. Forwards to `saga-orchestrator-service` via gRPC (`startInitiatePaymentSaga`).
4. Saga executes (all synchronous gRPC):
   - Validate booking exists and is not expired
   - Lock seats in `event-service`
   - Mark booking as `PAYMENT_INITIATED`
   - Create local Payment record + Razorpay Order
5. If any step fails, the saga runs compensation (release seats, revert booking to `PENDING`).
6. Returns Razorpay order details so the frontend can load the payment portal.

### Razorpay Webhook: `POST /api/v1/payment/webhook/razorpay`
**Fully Event-Driven Asynchronous Settlement.**
1. Verifies webhook signature using Razorpay SDK.
2. Persists the raw webhook payload to `PaymentEvent` table (audit trail).
3. Opens a DB transaction:
   - Updates `Payment` status to `SUCCESS` or `FAILED`.
   - Inserts the corresponding event (`payment.success` or `payment.failed`) into the `OutboxEvent` table.
4. Returns HTTP 200 to Razorpay immediately.
5. In the background, the `OutboxWorker` polls and publishes the event to Kafka.
6. The `PaymentEventConsumer` reads it and settles the booking/seat state asynchronously:
   - **Success:** Confirms booking + confirms seats (LOCKED → SOLD).
   - **Failure:** Cancels booking + releases seats (LOCKED → AVAILABLE).
7. If a payment success arrives for a booking already marked `FAILED`, the system automatically records the receipt and triggers a refund (money is never stuck).

### `POST /api/v1/payment/:paymentId/refund`
1. Validates the payment exists and is in `SUCCESS` status.
2. Calls Razorpay API to issue a live refund (protected by `externalWrite` circuit breaker).
3. Opens a DB transaction:
   - Updates Payment to `REFUNDED`.
   - Inserts `payment.refunded` into Outbox.
4. The Kafka consumer triggers async booking cancellation and bulk seat release.
5. Sends a refund notification email (best-effort — failure does not roll back the refund).

## Event APIs

### `DELETE /api/v1/event/:id/cancel`
**Triggers the Cancel Event Saga (Asynchronous).**
1. Validates the event exists and checks for active bookings via paginated gRPC lookup.
2. Calls `saga-orchestrator-service` via gRPC (`startCancelEventSaga`).
3. Saga orchestrator creates a `Saga` record and publishes `saga.cancel.event.requested` via Outbox → Kafka.
4. Returns `202 Accepted` to the admin immediately.
5. The `CancelEventSagaConsumer` picks up the command and processes it asynchronously (see `03_Business_Workflows.md`).
