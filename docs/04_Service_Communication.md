# 04 Service Communication

This document captures the communication paths that are currently implemented.

## Interaction Matrix

| Source | Target | Protocol | Purpose |
| --- | --- | --- | --- |
| API Gateway | All services | HTTP | Ingress and proxying |
| Booking | Event | gRPC | Read enrichment, seat confirm, bulk release |
| Booking | Payment | gRPC | Payment read enrichment |
| Payment | Saga | gRPC | Start payment-init saga |
| Payment | Booking | gRPC | Payment settlement updates via consumer |
| Payment | Event | gRPC | Payment settlement seat operations via consumer |
| Payment | User | gRPC | Refund notification lookup |
| Saga | Booking | gRPC | Booking lookup and booking state mutation |
| Saga | Event | gRPC | Seat lock and release |
| Saga | Payment | gRPC | Payment creation and bulk refund |
| Event | Saga | gRPC | Start cancel-event saga |
| Booking | Kafka | Async | Outbox publishing |
| Payment | Kafka | Async | Outbox publishing and consumer settlement |
| Saga | Kafka | Async | Cancel-event saga command flow |

## Active Kafka Topics

| Topic | Producer | Consumer | Purpose |
| --- | --- | --- | --- |
| `booking.created` | Booking | None | Legacy outbox event, currently unused |
| `payment.success` | Payment | Payment | Confirm booking and seats |
| `payment.failed` | Payment | Payment | Cancel booking and release seats |
| `payment.refunded` | Payment | Payment | Cancel booking and bulk release seats |
| `saga.cancel.event.requested` | Saga | Saga | Execute cancel-event saga |

## Important Communication Notes

- Payment initiation is now saga-owned, not payment-service-owned.
- The payment-init saga is synchronous from the caller's perspective because it must return the Razorpay order payload immediately.
- Refund settlement remains event-driven in `payment-service` after refund completion.
- `booking.created` is still emitted, but it is not part of the active seat-locking path.
