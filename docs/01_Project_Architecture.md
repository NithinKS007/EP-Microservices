# 01 Project Architecture

This repository implements an event-booking platform with service-owned databases, an API gateway for ingress, gRPC for internal calls, Kafka for asynchronous settlement, and a dedicated saga orchestrator for distributed workflows.

## Service Boundaries

| Service | Responsibility | Interfaces |
| --- | --- | --- |
| `api-gateway` | Public ingress, auth verification, request proxying | HTTP |
| `auth-service` | Authentication, token lifecycle, password reset | HTTP + gRPC |
| `user-service` | User profile boundary | HTTP + gRPC |
| `event-service` | Event catalog and seat inventory | HTTP + gRPC |
| `booking-service` | Booking records, booking reads, expiry job | HTTP + gRPC + Kafka outbox |
| `payment-service` | Payment creation, webhook processing, refunds | HTTP + gRPC + Kafka outbox/consumer |
| `saga-orchestrator-service` | Distributed orchestration and compensation | gRPC + Kafka outbox/consumer |
| `utils` | Shared middleware, Kafka helpers, gRPC contracts | Shared code |

## Common Layering

Each domain service follows the same broad shape:

```text
src/
- app.ts
- server.ts
- config/
- controllers/
- dtos/
- entity/
- grpc/
- interface/
- repositories/
- routes/
- services/
- utils/
```

- `controllers/` map transport input to service calls
- `services/` hold business logic
- `repositories/` own Prisma data access
- `grpc/` owns east-west contracts
- service-local workers/jobs handle outbox and recovery

## Current Booking And Payment Ownership

The current codebase now splits responsibility like this:

- `booking-service` owns booking state and booking read APIs.
- `payment-service` owns payment creation, webhook settlement, and refund initiation.
- `saga-orchestrator-service` owns distributed payment initiation orchestration across booking, event, and payment services.

That means the distributed path for payment initiation no longer lives in `payment-service`.

## Implemented Payment Initiation Saga

`POST /api/v1/payment/:bookingId/initiate` still enters through `payment-service`, but the orchestration is now delegated to `saga-orchestrator-service` over gRPC.

The saga performs:

1. booking lookup and ownership/state validation
2. seat locking in `event-service`
3. booking state transition to `PAYMENT_INITIATED`
4. payment creation in `payment-service`
5. compensation on failure:
   - booking status rollback to `PENDING`
   - seat release through `event-service`

This is the primary distributed transaction in the booking lifecycle and now correctly lives at the saga boundary.

## Persistence Model

- `booking-service`: `Booking`, `BookingSeat`, `OutboxEvent`
- `payment-service`: `Payment`, `PaymentEvent`, `OutboxEvent`
- `event-service`: `Event`, `Seat`
- `saga-orchestrator-service`: `Saga`, `SagaStep`, `OutboxEvent`

## Outbox And Async Settlement

The following async paths remain in place:

- `payment.success` confirms booking and seats
- `payment.failed` cancels booking and releases seats
- `payment.refunded` cancels booking and bulk releases seats
- `saga.cancel.event.requested` drives cancel-event orchestration

## Current Known Gaps

- `booking.created` is still emitted but no service consumes it.
- Booking creation still does not validate authoritative seat availability, event state, or pricing before persistence.
- `BookingSeat.seatId` remains globally unique, which still blocks clean rebooking after a cancelled or expired booking.
- `auth-service` still has unrelated build issues outside this booking/payment slice.
