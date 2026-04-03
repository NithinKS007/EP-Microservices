# 02 API Flows

This document describes the implemented booking and payment request paths.

## Generic Request Path

1. Client calls API gateway.
2. Gateway authenticates protected requests and forwards auth headers.
3. Target service applies context logging and DTO validation.
4. Controller calls the service layer.
5. Service uses repositories, gRPC, and Kafka as needed.
6. Response returns through gateway.

## Booking APIs

### POST `/api/v1/booking`

Flow:

1. Validate DTO and actor.
2. Insert `Booking(status = PENDING)`.
3. Insert `BookingSeat[]`.
4. Insert outbox `booking.created`.

Important:

- This endpoint still does not lock seats.
- It still trusts client seat and amount input.

### GET `/api/v1/booking`

Flow:

1. Load bookings from `booking-service`.
2. gRPC `event-service.findEventsByIdsWithSeats`.
3. gRPC `payment-service.findPaymentsByBookingIds`.
4. Return enriched bookings.

### GET `/api/v1/booking/:id`

Flow:

1. Load one booking.
2. Enrich with event/seat details from `event-service`.
3. Enrich with payment status from `payment-service`.

### POST `/api/v1/booking/:id/confirm`

Flow:

1. Validate ownership or admin access.
2. Require payment status `SUCCESS`.
3. Confirm seats in `event-service`.
4. Update booking to `CONFIRMED`.

### POST `/api/v1/booking/:id/cancel`

Flow:

1. Validate ownership or admin access.
2. Reject cancellation of `EXPIRED` bookings.
3. Require refunded payment before cancelling a confirmed booking.
4. Bulk release seats for the booking.
5. Update booking to `CANCELLED`.

### POST `/api/v1/booking/:id/expire`

Flow:

1. Validate ownership or admin access.
2. Only allow open bookings.
3. Reject expiry of successfully paid bookings.
4. Bulk release seats for the booking.
5. Update booking to `EXPIRED`.

## Payment APIs

### POST `/api/v1/payment/:bookingId/initiate`

Flow:

1. Request reaches `payment-service`.
2. `payment-service` delegates to `saga-orchestrator-service` gRPC `startInitiatePaymentSaga`.
3. Saga validates booking and actor.
4. Saga locks seats.
5. Saga updates booking to `PAYMENT_INITIATED`.
6. Saga calls `payment-service` gRPC `createPayment`.
7. Saga returns payment/order details synchronously.
8. If any downstream step fails, the saga compensates by restoring booking state and releasing seats.

### POST `/api/v1/payment/:paymentId/refund`

Flow:

1. `payment-service` validates actor and payment state.
2. Calls Razorpay refund API.
3. Updates payment to `REFUNDED`.
4. Inserts `PaymentEvent(payment.refunded)`.
5. Writes outbox `payment.refunded`.
6. Payment consumer cancels booking and bulk releases seats.

### POST `/api/v1/payment/webhook/razorpay`

Flow:

1. Preserve raw body with `express.raw`.
2. Verify Razorpay signature.
3. On capture:
   - set payment `SUCCESS`
   - insert payment event
   - write outbox `payment.success`
4. On failure:
   - set payment `FAILED`
   - insert payment event
   - write outbox `payment.failed`

### GET `/api/v1/payment/:id`

Returns one payment by payment ID.

### GET `/api/v1/payment/bookings/:id`

Returns the payment for one booking ID when present.
