# 02 API flows for every endpoint

This document outlines the end-to-end request lifecycle for all major API endpoints in the system.

## Generic Request Path (Standard)
1.  **Client** sends Request.
2.  **API Gateway** receives Request.
3.  **Gateway Middleware**: `helmet`, `cors`, `RateLimiter`.
4.  **Gateway Proxy**: `http-proxy-middleware` forwards request to the target Microservice.
5.  **Microservice Router**: Receives request at the port (e.g., 3001, 3002, etc.).
6.  **Microservice Core Middleware**: `customMiddleware.context` and `customMiddleware.requestLogger` initialize tracing.
7.  **Microservice Auth & Validation**: `authenticate` and `validateDto` secure the route.
8.  **Microservice Controller**: Extracted body/query/headers, calls Service method.
9.  **Microservice Service**: Implements business decisions, interacts with Repository or other Services.
10. **Microservice Repository**: Executes Prisma queries against the dedicated Database.
11. **Microservice Outbox**: (Optional) Enqueues events to the `OutboxEvent` table.
12. **Response**: Path reverses back to the Client.

---

## 1. Authentication Service (`auth-service`)

### POST `/api/v1/auth/sign-up`
*   **Flow**: Gateway → Auth Controller (`signUp`) → Auth Service (`signUp`) → User Repository.
*   **Logic**: Hashes password → Checks for duplicate email → Creates User record.
*   **Outcome**: User account created, JWT issued.

### POST `/api/v1/auth/sign-in`
*   **Flow**: Gateway → Auth Controller (`signIn`) → Auth Service (`signIn`) → User Repository.
*   **Logic**: Validates credentials → Generates Access/Refresh tokens → Stores Refresh token in Redis.
*   **Outcome**: Tokens returned to client.

---

## 2. User Service (`user-service`)

### GET `/api/v1/users/me`
*   **Flow**: Gateway → Auth Service (Token verification) → User Controller (`getMe`) → User Service (`getUserById`) → User Repository.
*   **Logic**: Fetches user profile data from `ep_user_service` database based on the `x-id` header.

---

## 3. Event Service (`event-service`)

### POST `/api/v1/events` (Create Event)
*   **Flow**: Gateway → Event Controller (`createEvent`) → Event Service (`createEvent`) → Event Repository.
*   **Validation**: Event date must be in the future.
*   **Outcome**: Event record created in `ep_event_service`.

### GET `/api/v1/events` (List Events)
*   **Flow**: Gateway → Event Controller (`findEvents`) → Event Service (`findEventsWithPagination`) → Event Repository.

---

## 4. Booking Service (`booking-service`)

### POST `/api/v1/bookings` (Create Booking)
*   **Flow**: Gateway → Booking Controller (`create`) → Booking Service (`create`) → **UnitOfWork Transaction**.
*   **Logic**:
    1.  Validates `eventId` and `seatIds`.
    2.  Extracts `idempotency-key` from headers to prevent duplicate executions.
    3.  Creates `Booking` entry (Status: `PENDING`).
    4.  Creates `BookingSeat` entries.
    5.  Creates `OutboxEvent` (`booking.created`).
*   **Cross Service**: Enrichment (gRPC) to verify seat availability via Event Service.
*   **Outcome**: Returns `bookingId`.

### GET `/api/v1/bookings/:id` (Get Booking Details)
*   **Flow**: Gateway → Booking Controller (`findBookingById`) → Booking Service (`findBookingByIdWithDetails`).
*   **Cross Service Call (gRPC)**:
    1.  `EventServiceGrpcClient`: Fetch event and seat labels.
    2.  `PaymentServiceGrpcClient`: Fetch associated payment status.
*   **Outcome**: Enriched booking response (including event name and payment status).

---

## 5. Payment Service (`payment-service`)

### POST `/api/v1/payment/webhook/razorpay`
*   **Flow**: Razorpay → Gateway → Payment Controller (`handleWebhook`).
*   **Middleware**: Uses `express.raw({ type: "application/json" })` to preserve raw payload for Razorpay signature verification.
*   **Logic**:
    1.  Verifies Razorpay signature.
    2.  If event is `payment.captured`:
        - Update `Payment` status to `SUCCESS`.
        - Create `OutboxEvent` (`payment.success`).
    3.  If event is `payment.failed`:
        - Update `Payment` status to `FAILED`.
        - Create `OutboxEvent` (`payment.failed`).
*   **Outcome**: Payment state persisted and downstream events queued.

---

## 6. Saga Orchestrator (`saga-service`)

### PATCH `/api/v1/events/:id/cancel` (Initiate Event Cancellation)
*   **Flow**: Gateway → Event Controller → **SagaServiceGrpcClient** (`startCancelEventSaga`).
*   **Saga Consumer Flow**:
    1.  `Saga Orchestrator` receives `saga.cancel.event.requested` via Kafka.
    2.  **Step 1 (gRPC)**: Call `EventService.markEventCancelled`.
    3.  **Fetch (gRPC)**: `BookingService.findBookingsByEvent`.
    4.  **Step 2 (gRPC)**: Call `PaymentService.bulkRefundPayments`.
    5.  **Step 3 (gRPC)**: Call `BookingService.bulkCancelBookings`.
    6.  **Step 4 (gRPC)**: Call `EventService.bulkReleaseSeats`.
*   **Outcome**: Event and all dependent records (Bookings/Payments/Seats) settled/cancelled.
