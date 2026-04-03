# 05 Impact And Diagrams

## Payment Initiation Saga

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant P as Payment Service
    participant S as Saga Orchestrator
    participant B as Booking Service
    participant E as Event Service

    C->>G: POST /api/v1/payment/:bookingId/initiate
    G->>P: initiate payment
    P->>S: gRPC startInitiatePaymentSaga
    S->>B: FindBooking
    S->>E: LockSeats
    S->>B: UpdateBookingStatus(PAYMENT_INITIATED)
    S->>P: gRPC CreatePayment
    P-->>S: payment/order details
    S-->>P: saga result
    P-->>C: payment/order details
```

## Payment Initiation Compensation

```mermaid
flowchart TD
    Fail[Failure after lock or booking update] --> Saga[Saga enters compensating]
    Saga --> RollbackBooking[Update booking back to PENDING]
    Saga --> ReleaseSeats[Bulk release seats]
    RollbackBooking --> Done[Compensated]
    ReleaseSeats --> Done
```

## Refund Settlement

```mermaid
sequenceDiagram
    participant C as Client
    participant P as Payment Service
    participant K as Kafka
    participant B as Booking Service
    participant E as Event Service

    C->>P: POST /api/v1/payment/:paymentId/refund
    P->>P: Razorpay refund + update payment
    P-->>K: payment.refunded
    K->>P: consume payment.refunded
    P->>B: UpdateBookingStatus(CANCELLED)
    P->>E: BulkReleaseSeats
```

## Table Impact

| Flow | Tables Updated | Tables Inserted |
| --- | --- | --- |
| Booking create | `booking`, `bookingSeat` | `outbox_events` |
| Payment-init saga | `booking` via gRPC, `seats` via gRPC | `saga`, `saga_steps`, `payments` |
| Payment webhook success | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |
| Payment webhook failure | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |
| Refund | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |

## Current Risk Notes

- `booking.created` still has no consumer.
- Rebooking remains blocked by the current `BookingSeat.seatId` uniqueness constraint.
- Refund settlement is still not modeled as a dedicated refund saga.
