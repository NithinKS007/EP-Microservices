# 01 Project Architecture

This repository implements a modular event-booking platform designed around clear isolation boundaries, independent data stores, and a carefully managed hybrid of synchronous (gRPC) and asynchronous (Kafka) interactions.

## Architecture Philosophy

### What is the structure?
The platform is broken into independent services representing bounded contexts (`booking`, `payment`, `user`, `auth`, `event`, and an orchestrator `saga`). All traffic from clients enters through a centralized `api-gateway`. 

### Why this design?
- **Domain Independence:** Changes to booking logic do not require touching the auth codebase.
- **Data Encapsulation:** A service cannot directly query another service's database. If `booking-service` needs event details, it must ask via gRPC.
- **Resilience:** The failure of the payment provider webhook doesn't stop users from browsing events or creating pending bookings.

## Persistence Model

### What it is
Each service completely owns its subset of the PostgeSQL database (structurally distinct logic).
- **`auth-service`**: `UserCredentials`, `TokenBlacklist`
- **`user-service`**: `UserProfile`
- **`event-service`**: `Event`, `Seat`
- **`booking-service`**: `Booking`, `BookingSeat`, `OutboxEvent`
- **`payment-service`**: `Payment`, `PaymentEvent`, `OutboxEvent`
- **`saga-orchestrator-service`**: `Saga`, `SagaStep`, `OutboxEvent`

### Why it works this way
Microservices must be independently deployable. Shared databases lead to tight coupling where changing a column in `user-service` accidentally breaks `payment-service`. By enforcing strict boundaries, we guarantee isolation.

## Service Boundaries

| Service | Responsibility | Interface Style |
| --- | --- | --- |
| `api-gateway` | Public ingress, auth verification, routing | HTTP |
| `auth-service` | Authentication, token generation, identity | HTTP |
| `user-service` | User profile data | HTTP + gRPC |
| `event-service` | Event catalog and seat locking logic | HTTP + gRPC |
| `booking-service` | Booking lifecycles and recovery jobs | HTTP + gRPC + Kafka |
| `payment-service` | Payment capture and provider webhooks | HTTP + gRPC + Kafka |
| `saga-orchestrator-service` | Cross-service distributed workflow management | gRPC + Kafka |
| `utils` | Shared middleware, Kafka clients, proto files | Shared Codebase |

## The Saga Orchestrator

### What is it?
A dedicated service (`saga-orchestrator-service`) that commands other services to perform steps in a large, distributed transaction.

### Why do we need it?
Suppose a user initiates a payment. We must:
1. Verify the booking exists.
2. Lock the seats.
3. Mark booking as initiated.
4. Tell Razorpay to generate an Order.

If step 4 fails, we *must* unlock the seats in Step 2. Doing this directly inside `payment-service` causes massive tight-coupling. The Orchestrator acts as the "Manager", using gRPC to issue commands and track state (`Saga` and `SagaStep` tables), easily executing compensations (rollbacks) when things fail.
