# 04 Cross-Service Communication Flow

This document maps the interactions between microservices, including protocols, synchronization styles, and failure handling.

## 1. Interaction Matrix

| Source Service | Target Service | Protocol | Type | Event / Method |
| :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | **Any** | HTTP | Sync | Request Proxying |
| **Booking** | **Event** | gRPC | Sync | `findEventsByIdsWithSeats` |
| **Booking** | **Payment** | gRPC | Sync | `findPaymentsByBookingIds` |
| **Booking** | **Kafka** | Kafka | Async | `booking.created` |
| **Payment** | **Kafka** | Kafka | Async | `payment.success`, `payment.failed` |
| **Saga Orchestrator** | **Event** | gRPC | Sync | `markEventCancelled`, `bulkReleaseSeats` |
| **Saga Orchestrator** | **Payment** | gRPC | Sync | `bulkRefundPayments` |
| **Saga Orchestrator** | **Booking** | gRPC | Sync | `bulkCancelBookings` |
| **Saga Orchestrator** | **Kafka** | Kafka | Async | `saga.cancel.event.completed`, `saga.cancel.event.failed` |

---

## 2. Synchronous Communication (gRPC)

The system uses **gRPC** for low-latency, type-safe internal calls where immediate data is required (Read-side enrichment or Command execution within a Saga).

### Failure Handling & Resilience:
*   **Timeouts**: Configured in gRPC clients (typically 5-10s).
*   **Circuit Breakers**: Implemented via `utils/src/circuit.breaker.ts`. The `Payment Service` leverages this for external Razorpay calls with specific thresholds (e.g., Timeout: `7000ms`, Reset Timeout: `20000ms`, Volume Threshold: `3` anomalies).
*   **Error Mapping**: Centralized in `utils/src/grpc/grpc.error.mapper.ts` to convert gRPC codes into human-readable app errors.

---

## 3. Asynchronous Communication (Kafka + Outbox)

The system relies on an **Event-Driven Architecture** for background consistency. To ensure reliability, it implements the **Transactional Outbox Pattern**.

### Workflow:
1.  **Service A** executes a DB transaction and inserts the event into its local `OutboxEvent` table.
2.  **Outbox Worker** (background loop) reads `PENDING` events.
3.  **Kafka Service** publishes the message to the broker.
4.  **Outbox Worker** updates event status to `SENT`.
5.  **Service B** (Consumer) processes the message.

### Topics:
*   `booking.created`: Emitted when a user initiates a reservation.
    > [!CAUTION]
    > Codebase audit reveals a critical missing component: No service currently listens to `booking.created`. The intended "Seat Locking" behavior is unimplemented as a consumer.
*   `payment.success` / `payment.failed`: Emitted after webhook verification.
*   `saga.cancel.event.requested`: Triggers the cancellation workflow.

---

## 4. Saga Orchestration (Failure & Compensation)

The `Saga Orchestrator` manages the lifecycle of the `CANCEL_EVENT` workflow.

### Strategy:
*   **Orchestration Style**: Centralized controller (`CancelEventSagaConsumer`).
*   **State Machine**: Persisted in the `Saga` and `SagaStep` tables.
*   **Retries**: 
    *   Individual steps have a `STEP_RETRY_LIMIT` (3).
    *   Uses **Exponential Backoff** (`Math.pow(2, attempt) * 1000ms`).
*   **Compensation**: 
    *   If a step fails permanently after retries, the saga is marked `failed`.
    *   Currently, the compensation is handled by the "Cancel" nature of the saga itself (reverting state). If the saga fails half-way, an administrator must intervene (logged as `Permanent Failure`).
*   **Dead Letter Queue (DLQ)**: Failed messages are sent to `saga.cancel.event.dlq` for auditing.

---

## 5. Socket Communication
*(Note: Based on codebase analysis, primary flows are HTTP/gRPC/Kafka. Real-time notifications via Sockets are structured in the `utils` library but primarily implemented as a future-proof abstraction or used for specific front-end updates not yet heavily detailed in core service logic.)*
