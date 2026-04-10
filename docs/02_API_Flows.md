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
Creates a brand new booking.
**Flow:**
1. Validates the incoming DTO and active user.
2. Creates the `Booking` record with `status = PENDING`.
3. Creates `BookingSeat[]` array representing the chosen seats.
4. Returns the response immediately to the user.
*Note: This endpoint does NOT lock the seats yet. Seat locking is intentionally delayed until Payment Initiation to prevent holding seats for users who abandon the checkout process.*

### `GET /api/v1/booking` & `GET /api/v1/booking/:id`
Retrieves booking details.
**Flow:**
1. Reads local `Booking` data.
2. Synchronously calls `event-service` via gRPC (`FindEventsByIdsWithSeats`) for the event and seat metadata.
3. Synchronously calls `payment-service` via gRPC (`findPaymentsByBookingIds`) to fetch the payment status.

### Manual State Overrides: Confirm, Cancel, Expire

These are explicit recovery/admin endpoints to manually override states.
They use **Synchronous gRPC** to alter the seat inventory immediately.
*Why Synchronous?* Because these operations are heavily dependent on state. A user expects a 200 OK for a cancellation to mean "my seats are absolutely released."

**`POST /api/v1/booking/:id/confirm`**
1. Validates payment status is `SUCCESS`.
2. gRPC call to `eventServiceGrpcClient.confirmSeats` (blocks until seat is mutated to `SOLD`).
3. Updates Booking to `CONFIRMED`.

**`POST /api/v1/booking/:id/cancel`**
1. Validates refund state (if it was paid).
2. gRPC call to `eventServiceGrpcClient.bulkReleaseSeats` (blocks until seats are `AVAILABLE`).
3. Updates Booking to `CANCELLED`.

**`POST /api/v1/booking/:id/expire`**
1. Validates booking is not already paid.
2. gRPC call to `eventServiceGrpcClient.bulkReleaseSeats`.
3. Updates Booking to `EXPIRED`.

## Payment APIs

### `POST /api/v1/payment/:bookingId/initiate`
**Delegates to Saga Orchestrator.**
1. Hits `payment-service`.
2. Forwards to `saga-orchestrator-service` (`startInitiatePaymentSaga`).
3. Saga executes:
   - Validate booking
   - Lock seats in `event-service`
   - Mark `PAYMENT_INITIATED`
   - Create local Payment record + Razorpay Order ID
4. Returns order details to the user synchronously so the frontend can load the payment portal.

### Razorpay Webhook: `POST /api/v1/payment/webhook/razorpay`
**Fully Event-Driven Asynchronous Settlement.**
1. Captures verification signature.
2. Updates `Payment` state to `SUCCESS` or `FAILED`.
3. Writes `payment.success` (or failed) to the Outbox table.
4. Gateway immediately returns 200 to Razorpay.
5. In the background, the outbox worker pushes the event to Kafka. The `PaymentEventConsumer` reads it and settles the booking/seat state asynchronously.

### `POST /api/v1/payment/:paymentId/refund`
1. Hits Razorpay to issue a live refund.
2. Updates Payment to `REFUNDED`.
3. Writes `payment.refunded` to Outbox.
4. Kafka Consumer triggers async cancellation and seat release.
