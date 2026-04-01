# 03 Business Workflow Analysis

This document explains the core business logic, decision points, and state transitions for the primary features of the platform.

## 1. Booking & Inventory Lifecycle

### User Action: Create Booking
1.  **Validation**:
    *   System checks if the target `eventId` exists and is `ACTIVE`.
    *   System checks if all requested `seatIds` are currently `AVAILABLE`.
2.  **Decision**:
    *   If any seat is already `LOCKED` or `SOLD`, the system rejects the request with a `ConflictError`.
3.  **State Transition**:
    *   **Booking Service**: Creates a `Booking` entry with status `PENDING`. It sets an `expiresAt` timestamp (default: **20 minutes**).
    *   *Note*: The Booking Service does not lock the seats synchronously.
4.  **Async Communication**:
    *   Booking service emits `booking.created` via the **Outbox Pattern**.
    *   > [!WARNING]
    *   > Currently, there is NO registered Kafka consumer for the `booking.created` event in the codebase. As a result, the intended behavior of the Event Service marking those seats as `LOCKED` does not occur. This is a critical missing implementation gap.
5.  **Final Output**: Returns `bookingId` to the client for payment initiation.

---

## 2. Payment Initiation & Webhook

### Action: Pay for Booking
> [!IMPORTANT]
> The webhook endpoint `/api/v1/payment/webhook/razorpay` strictly bypasses standard JSON parsing and uses `express.raw({ type: "application/json" })`. This ensures the raw payload buffer is preserved for accurate cryptographic signature verification by Razorpay.

1.  **Validation**:
    *   Payment service checks if the `bookingId` exists and is still `PENDING`.
    *   Checks if the booking has not **EXPIRED**.
2.  **Decision (External Provider)**:
    *   Razorpay order is created via the **Circuit Breaker** (protects against provider downtime).
3.  **State Transition**:
    *   `Payment` record created with status `INITIATED`.
4.  **Webhook Decision**:
    *   **Payment Captured**: Transition `Payment` to `SUCCESS` → Emit `payment.success`.
    *   **Payment Failed**: Transition `Payment` to `FAILED` → Emit `payment.failed`.

---

## 3. Event Cancellation (Saga Orchestration)

### Action: Admin Cancels Event
1.  **Condition Checked**:
    *   Event must be in the `FUTURE`.
    *   Admin user role verification in Gateway.
2.  **Saga Initiation**:
    *   `Saga Orchestrator` takes control.
3.  **Business Logic Flow**:
    *   **Step 1**: The event status is changed to `CANCELLED` (Event Service). No more bookings can be made.
    *   **Step 2**: The system identifies all associated `Bookings`.
    *   **Step 3 (Refunds)**: For every successful payment, the `Payment Service` initiates a bulk refund via the provider (Razorpay).
    *   **Step 4 (Cancellation)**: All `PENDING` or `CONFIRMED` bookings are marked as `CANCELLED`.
    *   **Step 5 (Inventory Release)**: Every booked/locked seat is released back to `AVAILABLE` status for the event location (if ever reopened, though status is CANCELLED).
4.  **State Transition**:
    *   Final state: All financial and inventory ties to this event are severed.

---

## 4. Booking Expiration (Automatic)

### Trigger: Cron Job or Background Worker
1.  **Condition Checked**:
    *   `expiresAt < now()` AND status is `PENDING`.
2.  **Decision**:
    *   If payment is not received within 20 minutes, the booking is stale.
3.  **State Transition**:
    *   **Booking Service**: Transition to `EXPIRED`.
    *   **Event Service**: Release associated seats back to `AVAILABLE`.
4.  **Outcome**: Seat inventory is reclaimed automatically for other users.
