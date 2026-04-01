# 05 Flowcharts, Diagrams, and Impact Analysis

This document provides visual representations of the system's flows and a deep dive into the database impact of each major business operation.

## 1. System Communication Diagram

```mermaid
flowchart TD
    Client[Client / Frontend]
    Gateway[API Gateway]
    Auth[Auth Service]
    User[User Service]
    Event[Event Service]
    Booking[Booking Service]
    Payment[Payment Service]
    Saga[Saga Orchestrator]
    Kafka[(Kafka Event Bus)]
    Redis[(Redis Cache)]

    Client <-->|HTTP| Gateway
    Gateway <-->|HTTP| Auth
    Gateway <-->|HTTP| User
    Gateway <-->|HTTP| Event
    Gateway <-->|HTTP| Booking
    Gateway <-->|HTTP| Payment

    Auth <-->|Cache| Redis
    
    Booking -.->|gRPC| Event
    Booking -.->|gRPC| Payment
    Saga -.->|gRPC| Event
    Saga -.->|gRPC| Payment
    Saga -.->|gRPC| Booking

    Booking --Outbox--> Kafka
    Payment --Outbox--> Kafka
    Saga --Outbox--> Kafka
    Kafka -.->|Subscribe| Saga
```

---

## 2. API Sequence Diagram (Booking Flow)

This diagram shows the end-to-end journey of a seat reservation.

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant B as Booking Service
    participant E as Event Service
    participant K as Kafka

    C->>G: POST /api/v1/bookings
    G->>B: Proxy Request
    B->>E: gRPC: Check Seat Availability
    E-->>B: Seat Status (AVAILABLE)
    B->>B: DB Transaction: Create Booking & Outbox
    B-->>G: 201 Created (bookingId)
    G-->>C: Response
    B-->>K: Publish: booking.created
```

---

## 3. Saga Orchestration Flow (Event Cancellation)

This flowchart illustrates the multi-service compensation logic when an event is cancelled.

```mermaid
flowchart TD
    Start([Admin: Cancel Event]) --> SagaInit[Saga: Create CANCEL_EVENT]
    SagaInit --> Step1[Step 1: Event Service - Mark Cancelled]
    Step1 --> FetchBookings[Fetch all Event Bookings via gRPC]
    FetchBookings --> Step2[Step 2: Payment Service - Bulk Refund]
    Step2 --> Step3[Step 3: Booking Service - Bulk Cancel]
    Step3 --> Step4[Step 4: Event Service - Bulk Release Seats]
    Step4 --> Complete([Saga Completed & Notify])

    subgraph Failure Handling
        Step1 --Retry 3x--> DLQ[Send to DLQ]
        Step2 --Retry 3x--> DLQ
        Step3 --Retry 3x--> DLQ
        Step4 --Retry 3x--> DLQ
    end
```

---

## 4. Table Impact Analysis

This table documents which database tables are affected during core operations.

| Feature Flow | Tables Read | Tables Updated | Tables Inserted | Enums Used |
| :--- | :--- | :--- | :--- | :--- |
| **User Sign-up** | `User` (Identity check) | - | `User` | `Role` |
| **Create Booking** | `Event`, `Seat` | `Seat` (LOCKED) | `Booking`, `BookingSeat`, `OutboxEvent` | `BookingStatus`, `SeatStatus` |
| **Payment Webhook** | `Payment` | `Payment` (SUCCESS) | `PaymentEvent`, `OutboxEvent` | `PaymentStatus` |
| **Cancel Event Saga** | `Event`, `Booking`, `Payment` | `Event`, `Booking`, `Payment`, `Seat` | `Saga`, `SagaStep`, `OutboxEvent` | `SagaStatus`, `StepStatus` |
| **Booking Expiry** | `Booking`, `Seat` | `Booking` (EXPIRED), `Seat` (AVAILABLE) | `OutboxEvent` | `BookingStatus` |

### Transaction Boundaries & Race Conditions

1.  **Booking Reservation**:
    *   **Boundary**: Single microservice transaction (`Booking`) + internal gRPC calls to `Event` to lock seats.
    *   **Race Condition**: Two users booking the same seat at the exact same millisecond. 
    *   **Mitigation**: `Event Service` uses a database-level `atomic updateMany` with a status check (`where seatStatus = AVAILABLE`) to ensure only one user can claim the lock.
2.  **Payment Reconciliation**:
    *   **Boundary**: Payment Service transaction (Update Payment + Insert Outbox).
    *   **Race Condition**: Duplicate webhooks from the provider (Razorpay).
    *   **Mitigation**: Idempotency checks on `providerRef` in the `Payment Repository`.

---

## 5. Deployment Overview (Corpus Context)

The system is designed for **Dockerized Deployment**.

*   Each service has a dedicated `Dockerfile`.
*   A root-level `docker-compose.yml` orchestrates all services and the Kafka/Postgres infrastructure.
*   The `utils` module is shared as a local dependency using Node.js logic.
