# 05 Impact and Diagrams

Visual representations of the critical system flows.

## 1. Payment Initiation (Synchronous Orchestration)

This flow is executed when the user clicks 'Pay'. It must return rapidly.

```mermaid
sequenceDiagram
    participant C as Client
    participant P as Payment Service
    participant S as Saga Orchestrator
    participant B as Booking Service
    participant E as Event Service

    C->>P: POST /payment/:bookingId/initiate
    P->>S: gRPC startInitiatePaymentSaga
    S->>B: gRPC FindBooking (Validate ownership, state, expiry)
    S->>E: gRPC LockSeats (seatStatus → LOCKED)
    S->>B: gRPC UpdateBookingStatus(PAYMENT_INITIATED)
    S->>P: gRPC CreatePayment (External Razorpay API call)
    P-->>S: payment + Razorpay order details
    S-->>P: Saga Success Result
    P-->>C: Returns Razorpay Checkout Data
```

## 2. Payment Initiation Compensation (Failure Fallback)

If Razorpay goes down while the user tries to pay, we must unlock the seats immediately.

```mermaid
flowchart TD
    Initiate[User clicks Pay] --> ValidateBooking(Validate Booking via gRPC)
    ValidateBooking --> LockSeats(Lock Seats in Event Service)
    LockSeats --> Initiated(Booking = PAYMENT_INITIATED)
    Initiated --> Razorpay(Create Razorpay Order)
    Razorpay -- Fails --> Saga(Saga triggers Compensation)
    Saga --> CheckFlags{Which steps executed?}
    CheckFlags -->|bookingMarkedInitiated=true| RollbackBooking(gRPC: Revert booking to PENDING)
    CheckFlags -->|seatsLocked=true| ReleaseSeats(gRPC: Release Seats for Booking)
    RollbackBooking --> Done[Transaction cleanly rolled back]
    ReleaseSeats --> Done
```

## 3. Webhook Settlement (Asynchronous Flow)

When Razorpay eventually confirms payment success, it fires a webhook.

```mermaid
sequenceDiagram
    participant R as Razorpay
    participant P as Payment Service
    participant DB as Postgres (Outbox)
    participant K as Kafka
    participant PC as Payment Consumer
    participant B as Booking Service
    participant E as Event Service

    R->>P: Webhook Payload
    P->>P: Verify Signature
    Note over P,DB: DB Transaction Start
    P->>DB: Update Payment Status = SUCCESS
    P->>DB: Insert "payment.success" into OutboxEvent
    Note over P,DB: DB Transaction End
    P-->>R: HTTP 200 OK (Fast Return)

    Note over DB,K: OutboxWorker polls every 5s
    DB->>K: SELECT FOR UPDATE SKIP LOCKED → publish to Kafka
    K->>PC: PaymentEventConsumer reads payload
    PC->>B: gRPC UpdateBookingStatus(CONFIRMED)
    PC->>E: gRPC ConfirmSeats (LOCKED → SOLD)

    Note over PC: If consumer fails after 3 retries
    PC->>K: Publish to payment.success.dlq
```

## 4. Cancel Event Saga (Asynchronous Orchestration)

A long-running, multi-step process for admins.

```mermaid
sequenceDiagram
    participant C as Admin Client
    participant EV as Event Service
    participant S as Saga Orchestrator
    participant DB as Outbox Table
    participant K as Kafka
    participant SC as Saga Consumer
    participant P as Payment Service
    participant B as Booking Service

    C->>EV: DELETE /event/:id/cancel
    EV->>S: gRPC startCancelEventSaga
    Note over S,DB: Transaction: Create Saga + Outbox Event
    S-->>EV: 202 Accepted (sagaId)
    EV-->>C: 202 Accepted

    DB->>K: OutboxWorker publishes saga.cancel.event.requested
    K->>SC: CancelEventSagaConsumer picks up command

    SC->>EV: gRPC markEventCancelled (status → CANCELLED)

    loop Fetch bookings in batches of 500
        SC->>B: gRPC findBookingsByEvent (page, limit=500)
    end

    alt Bookings exist
        SC->>P: gRPC bulkRefundPayments (3 retries per step)
        SC->>B: gRPC bulkCancelBookings
        SC->>EV: gRPC bulkReleaseSeats
    else No bookings
        Note over SC: Skip payment, booking, seat steps
    end

    Note over SC,DB: Transaction: Mark saga completed + Outbox
    DB->>K: saga.cancel.event.completed
```

## 5. Booking Expiry (Cron Recovery)

```mermaid
sequenceDiagram
    participant Cron as Expiry Job (Every Min)
    participant B as Booking Service
    participant E as Event Service
    participant P as Payment Service

    Cron->>B: Find expired bookings (limit 100)
    loop For each expired booking
        B->>E: gRPC bulkReleaseSeats
        B->>P: gRPC bulkFailPayments
    end
    B->>B: Bulk update statuses to EXPIRED
```

## Table Impact Matrix

| Flow | Tables Updated | Tables Inserted |
| --- | --- | --- |
| Booking create | `booking`, `bookingSeat` | — |
| Payment-init saga | `booking` via gRPC, `seats` via gRPC | `saga`, `saga_steps`, `payments` |
| Payment webhook success | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |
| Payment webhook failure | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |
| Refund | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |
| Cancel event saga | `event`, `payments`, `bookings`, `seats` (all via gRPC) | `saga`, `saga_steps`, `outbox_events` |
| Booking expiry | `bookings`, `seats` via gRPC, `payments` via gRPC | — |
