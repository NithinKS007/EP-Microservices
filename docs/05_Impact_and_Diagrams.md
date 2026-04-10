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
    S->>B: gRPC FindBooking (Validate)
    S->>E: gRPC LockSeats
    S->>B: gRPC UpdateBookingStatus(PAYMENT_INITIATED)
    S->>P: gRPC CreatePayment (External Razorpay Call)
    P-->>S: payment / order details
    S-->>P: Success Result
    P-->>C: returns Checkout Data
```

## 2. Payment Initiation Compensation (Failure Fallback)

If Razorpay goes down while the user tries to pay, we must unlock the seats immediately.

```mermaid
flowchart TD
    Initiate[User clicks Pay] --> LockSeats(Lock Seats in Event Service)
    LockSeats --> Initiated(Booking = PAYMENT_INITIATED)
    Initiated --> Razorpay(Create Razorpay Order)
    Razorpay -- Fails --> Saga(Saga triggers Compensation)
    Saga --> RollbackBooking(gRPC Update booking back to PENDING)
    Saga --> ReleaseSeats(gRPC Bulk Release Seats for Booking)
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
    participant B as Booking Service
    participant E as Event Service

    R->>P: Webhook Payload
    P->>P: Verify Signature
    Note over P,DB: DB Transaction Start
    P->>DB: Update Payment Status = SUCCESS
    P->>DB: Insert "payment.success" to OutboxEvent
    Note over P,DB: DB Transaction End
    P-->>R: HTTP 200 OK (Fast Return)

    Note over DB,K: Background Worker
    DB->>K: Outbox worker loops -> publishes to Kafka
    K->>P: PaymentEventConsumer reads payload
    P->>B: gRPC UpdateBookingStatus(CONFIRMED)
    P->>E: gRPC ConfirmSeats
```

## 4. Cancel Event Saga (Asynchronous Orchestration)

A long-running, multi-step process for admins.

```mermaid
sequenceDiagram
    participant C as Admin Client
    participant E as Event Service
    participant K as Kafka
    participant S as Saga Orchestrator
    participant P as Payment Service
    participant B as Booking Service

    C->>E: DELETE /event/:id
    E->>E: Mark Event Cancelled
    E->>K: Outbox publishes saga.cancel.event.requested
    E-->>C: 202 Accepted (Backgrounding)

    K->>S: Consumer picks up task
    loop For Every Affected Booking
        S->>P: gRPC bulkRefundPayments
        S->>B: gRPC bulkCancelBookings
        S->>E: gRPC bulkReleaseSeats
    end
    S->>K: Outbox publishes saga.cancel.event.completed
```

## Table Impact Matrix

| Flow | Tables Updated | Tables Inserted |
| --- | --- | --- |
| Booking create | `booking`, `bookingSeat` | `outbox_events` *(for eventual observability)* |
| Payment-init saga | `booking` via gRPC, `seats` via gRPC | `saga`, `saga_steps`, `payments` |
| Payment webhook success | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |
| Payment webhook failure | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |
| Refund | `payments`, `booking` via consumer, `seats` via consumer | `payment_events`, `outbox_events` |
