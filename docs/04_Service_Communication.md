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

## Interaction Matrix

| Source | Target | Protocol | Purpose |
| --- | --- | --- | --- |
| API Gateway | All services | HTTP | Ingress and proxying |
| Booking | Event | gRPC | Read enrichment, seat confirm, bulk release |
| Booking | Payment | gRPC | Payment read enrichment |
| Payment | Saga | gRPC | Start payment-init saga |
| Payment | Booking | gRPC | Payment settlement updates via Kafka consumer |
| Payment | Event | gRPC | Payment settlement seat operations via Kafka consumer |
| Payment | User | gRPC | Refund notification lookup |
| Saga | Booking | gRPC | Booking lookup and booking state mutation |
| Saga | Event | gRPC | Seat lock and release |
| Saga | Payment | gRPC | Payment creation and bulk refund |
| Event | Saga | gRPC | Start cancel-event saga |
| Booking | Kafka | Async | Outbox publishing (Observability) |
| Payment | Kafka | Async | Outbox publishing and consumer settlement |
| Saga | Kafka | Async | Cancel-event saga command flow and Recovery Crons |

## Active Kafka Topics

| Topic | Producer | Consumer | Purpose |
| --- | --- | --- | --- |
| `payment.success` | Payment Outbox | Payment Consumer | Confirms booking and seats. |
| `payment.failed` | Payment Outbox | Payment Consumer | Cancels booking and releases seats. |
| `payment.refunded` | Payment Outbox | Payment Consumer | Cancels booking and bulk releases seats. |
| `saga.cancel.event.requested` | Saga Outbox | Saga Consumer | Executes long-running cancel-event saga. |
| `saga.cancel.event.completed` | Saga Outbox | None (Observability) | Fires when Saga successfully finishes. |
| `saga.cancel.event.failed` | Saga Outbox | None (Observability) | Fires when Saga enters terminal DLQ failure state. |
