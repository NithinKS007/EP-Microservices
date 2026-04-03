# 03 Business Workflows

This document describes the booking, payment, refund, and cancellation flows as they exist in code.

## Booking Creation

Current behavior:

1. Booking is created in `PENDING`.
2. Seats are recorded in `BookingSeat`.
3. Outbox `booking.created` is stored.

Current limitation:

- Seat locking does not happen here.

## Payment Initiation

Current behavior:

1. User calls `POST /api/v1/payment/:bookingId/initiate`.
2. `payment-service` forwards orchestration to `saga-orchestrator-service`.
3. Saga validates booking ownership and lifecycle state.
4. Saga locks seats in `event-service`.
5. Saga updates booking to `PAYMENT_INITIATED`.
6. Saga calls `payment-service` to create the provider order and local payment row.
7. If a downstream step fails, the saga compensates by:
   - updating booking back to `PENDING`
   - releasing seats

This is now the authoritative distributed transaction for payment initiation.

## Payment Success

1. Webhook marks payment `SUCCESS`.
2. Payment outbox writes `payment.success`.
3. Payment Kafka consumer:
   - confirms booking
   - confirms seats as sold

## Payment Failure

1. Webhook marks payment `FAILED`.
2. Payment outbox writes `payment.failed`.
3. Payment Kafka consumer:
   - cancels booking
   - releases seats

## Manual Refund

1. `payment-service` validates actor and payment state.
2. Calls Razorpay refund API.
3. Updates payment to `REFUNDED`.
4. Writes `payment.refunded`.
5. Payment Kafka consumer:
   - cancels booking
   - bulk releases seats

This downstream refund settlement is still event-driven and has not been moved into a separate refund saga yet.

## Manual Booking Recovery APIs

The repository exposes explicit booking recovery endpoints:

- `POST /api/v1/booking/:id/confirm`
- `POST /api/v1/booking/:id/cancel`
- `POST /api/v1/booking/:id/expire`

These are idempotent at the target terminal state and are intended for recovery/operator workflows.

## Booking Expiry Job

Every minute:

1. `booking-service` finds stale `PENDING` and `PAYMENT_INITIATED` bookings.
2. `event-service` bulk releases their seats.
3. `booking-service` marks them `EXPIRED`.

## Cancel Event Saga

The existing async cancel-event saga remains unchanged:

1. mark event cancelled
2. fetch affected bookings
3. bulk refund payments
4. bulk cancel bookings
5. bulk release seats

It uses persisted saga and saga-step state plus a recovery cron job for abandoned sagas.
