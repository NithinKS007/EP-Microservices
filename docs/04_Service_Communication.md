# 04 Service Communication

This document captures the communication paths implemented across the system and the explicit rules governing when to use which protocol.

## Why gRPC vs Kafka?

This platform mixes **Synchronous (gRPC)** and **Asynchronous (Kafka)** communication. The rules for choosing are strictly defined:

### When to use gRPC (Synchronous)
1. **Reads/Queries:** When a service needs immediate state to construct a response (e.g. `booking-service` needs seat info from `event-service` to serve `GET /api/v1/booking`).
2. **Saga Command execution:** The orchestrated steps in a Saga (`payment initiation saga`) require rigid, ordered steps that fail instantly if something breaks so compensations can kick in.
3. **Simple, high-priority manual overrides:** When a user clicks "cancel my booking", they demand an immediate guarantee that their seats are released.

### When to use Kafka (Asynchronous)
1. **Third-party Webhook Processing:** You cannot make a payment gateway like Razorpay wait for your internal services. Razorpay's webhook drops a success payload and expects a 200 OK instantly. Kafka consumes this payload and updates the booking/seat tables later.
2. **Long-running workflows:** Sagas that take heavy processing time (like `cancel event saga` looping over potentially thousands of bookings) are initiated by Kafka so as not to block external clients.

### Protection on all gRPC calls
Every gRPC client method in the system is protected by:
- **Deadlines:** 4s default for standard calls, 8-15s for payment/refund operations.
- **Circuit Breakers:** Using centralized policies from `resilience.policy.ts` (`internalQuery`, `internalCommand`, `externalWrite`, etc.).
- **Error Filtering:** Domain errors (4xx) do NOT trip the circuit breaker — only infrastructure failures do.

## Interaction Matrix

| Source | Target | Protocol | Purpose |
| --- | --- | --- | --- |
| API Gateway | All services | HTTP | Ingress and proxying |
| Booking | Event | gRPC | Read enrichment (`FindEventsByIdsWithSeats`), seat confirm, bulk release |
| Booking | Payment | gRPC | Payment read enrichment (`findPaymentsByBookingIds`), bulk fail payments |
| Payment | Saga | gRPC | Start payment-init saga |
| Payment | Booking | gRPC | Booking status updates via Kafka consumer |
| Payment | Event | gRPC | Seat lock, confirm, release via Kafka consumer |
| Payment | User | gRPC | Refund notification email lookup |
| Saga | Booking | gRPC | Booking lookup, status mutation, bulk cancel |
| Saga | Event | gRPC | Seat lock, release, mark event cancelled, bulk release |
| Saga | Payment | gRPC | Payment creation, bulk refund |
| Event | Saga | gRPC | Start cancel-event saga |
| Event | Booking | gRPC | Check active bookings before event deletion |
| Event | Payment | gRPC | Fetch payments for active booking checks |
| Auth | User | gRPC | User lookup for authentication and email availability |
| Booking | Kafka | Async | Outbox publishing |
| Payment | Kafka | Async | Outbox publishing and consumer-driven settlement |
| Saga | Kafka | Async | Cancel-event saga command flow and recovery events |

## Active Kafka Topics

### Business Topics

| Topic | Producer | Consumer | Purpose |
| --- | --- | --- | --- |
| `payment.success` | Payment Outbox | Payment Consumer | Confirms booking and seats after successful payment |
| `payment.failed` | Payment Outbox | Payment Consumer | Cancels booking and releases seats after failed payment |
| `payment.refunded` | Payment Outbox | Payment Consumer | Cancels booking and bulk releases seats after refund |
| `saga.cancel.event.requested` | Saga Outbox | Saga Consumer | Executes long-running cancel-event saga |
| `saga.cancel.event.completed` | Saga Outbox | None (Observability) | Fires when cancel-event saga successfully finishes |
| `saga.cancel.event.failed` | Saga Outbox | None (Observability) | Fires when cancel-event saga enters terminal failure |

### Dead Letter Queue Topics

| Topic | When Used | Action Required |
| --- | --- | --- |
| `payment.success.dlq` | Payment success consumer exhausts 3 retries | Manual: inspect, fix root cause, replay |
| `payment.failed.dlq` | Payment failure consumer exhausts 3 retries | Manual: inspect, fix root cause, replay |
| `payment.refunded.dlq` | Payment refund consumer exhausts 3 retries | Manual: inspect, fix root cause, replay |
| `saga.cancel.event.dlq` | Cancel-event saga step exhausts 3 retries | Manual: inspect saga state, resume or compensate |

### Kafka Producer Configuration
- `idempotent: true` — prevents duplicate message delivery
- `acks: -1` — all ISR replicas must acknowledge before success
- `allowAutoTopicCreation: false` — topics must be explicitly created
