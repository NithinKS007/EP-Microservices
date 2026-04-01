# 01 Project Architecture Analysis

This document provides a deep architectural analysis of the **Event Booking Platform**, a microservices-based backend designed for scalability, fault tolerance, and clear domain boundaries.

## 1. System Overview

The system is composed of several independent services communicating via **gRPC** (synchronous, internal) and **Kafka** (asynchronous, event-driven). It follows the **API Gateway** pattern for client ingress and uses the **Saga** pattern for distributed transactions.

### Core Services & Modules

| Service | Responsibility |
| :--- | :--- |
| **API Gateway** | Public ingress, Auth middleware, Proxying, Rate limiting. |
| **Auth Service** | Identity management, Token lifecycle (JWT/Refresh), Password resets. |
| **User Service** | User profiles, Identity domain logic. |
| **Event Service** | Event catalog, Seat inventory, Availability management. |
| **Booking Service** | Booking lifecycle, Reservation management, Expiration logic. |
| **Payment Service** | Razorpay integration, Webhooks, Refund processing. |
| **Saga Orchestrator** | Distributed workflow coordination, Error handling, Compensation. |

---

## 2. Folder Structure & Layer Separation

Each service follows a consistent **N-Tier/Clean Architecture** approach:

```text
src/
├── config/             # Environment & service-specific configurations
├── controllers/        # Express route handlers (Request/Response mapping)
├── services/           # Core business logic (Domain rules & orchestration)
├── repositories/       # Data access layer (Prisma/DB operations)
├── interface/          # TypeScript interfaces for Decoupling
├── dtos/               # Data Transfer Objects for validation
├── entity/             # Domain entities / Prisma types
├── routes/             # Express route definitions
├── grpc/               # gRPC clients and server definitions
├── utils/              # Service-level helpers (Logger, Error handlers)
├── app.ts              # Express application setup
└── server.ts           # Service entry point (Server start & Kafka/gRPC init)
```

### Layer Responsibilities

1.  **Entry Points (`server.ts`)**: Initializes the process, connects to PostgreSQL (Prisma), starts gRPC servers, and connects Kafka producers/consumers.
2.  **Routes**: Defines endpoints and attaches middleware (Auth, Validation).
3.  **Controllers**: Extracts data from requests, calls the Service layer, and formats the HTTP response.
4.  **Service Layer**: The heart of the system. Implements business logic, coordinates repository calls, and interacts with other services via gRPC/Kafka.
5.  **Repository Layer**: Encapsulates data persistence rules using Prisma. Uses the **Unit of Work** pattern for transactions.
6.  **Outbox Worker**: A background process in each service that polls the `OutboxEvent` table and publishes to Kafka, ensuring **At-Least-Once delivery**.

---

## 3. Middleware Architecture

The platform uses a centralized `utils` library for shared middleware:

*   **`authenticate`**: Validates JWTs, extracts user identity, and propagates metadata (`x-id`, `x-role`) to downstream services.
*   **`RateLimiter`**: Redis-backed rate limiting (implemented in API Gateway).
*   **`prismaErrorHandler`**: Centralized mapping of DB errors to HTTP status codes.
*   **`asyncHandler`**: Boilerplate for catching exceptions in async routes.

---

## 4. Connectivity & Integration

### External Integrations
*   **PostgreSQL**: Primary data store for all services (Dedicated DB per service).
*   **Redis**: Session/Token management (Auth) and Rate Limiting (Gateway).
*   **Kafka**: Event bus for cross-service workflows (Booking confirmed, Payment failed, etc.).
*   **Razorpay**: External payment provider (Payment Service).
*   **gRPC**: Type-safe internal RPC backbone using Protobufs.

### Service Connection Matrix

| Source | Target | Protocol | Purpose |
| :--- | :--- | :--- | :--- |
| **Gateway** | Any Service | **HTTP/Proxy** | Client request forwarding. |
| **Booking** | Event | **gRPC** | Fetch event details for booking enrichment. |
| **Booking** | Payment | **gRPC** | Fetch payment status for booking list. |
| **Saga** | Event | **gRPC** | Mark event cancelled, Release seats. |
| **Saga** | Payment | **gRPC** | Bulk refund payments for an event. |
| **Saga** | Booking | **gRPC** | Bulk cancel bookings for an event. |
| **Any Service** | Kafka | **TCP (Kafka)** | Publish domain events (Outbox pattern). |

---

## 5. Persistence & Schemas

The project uses **Prisma** with a modular schema approach (concatenated during build). Each service owns its data:

*   **Auth**: `RefreshToken`, `PasswordResetToken`.
*   **User**: `User`, `Role`.
*   **Event**: `Event`, `Seat` (Inventory).
*   **Booking**: `Booking`, `BookingSeat`.
*   **Payment**: `Payment`, `PaymentEvent`.
*   **Saga**: `Saga`, `SagaStep`.
*   **Common**: `OutboxEvent` (in every service except Gateway).

---

## 6. Event Bus & Saga Orchestration

### The Outbox Pattern
To avoid "Dual Write" problems (DB update + Kafka publish), every service writes the event to an internal `OutboxEvent` table within the same DB transaction as the business logic. A dedicated **Outbox Worker** then pushes these to Kafka.

### Saga Workflow (`CANCEL_EVENT`)
1.  **Request**: User cancels an event in `Event Service`.
2.  **Orchestration**: `Saga Service` creates a entry and emits `saga.cancel.event.requested`.
3.  **Step 1**: `Event Service` marks event as `CANCELLED`.
4.  **Step 2**: `Payment Service` bulk refunds all associated payments.
5.  **Step 3**: `Booking Service` marks all bookings as `CANCELLED`.
6.  **Step 4**: `Event Service` (Seat) releases reserved seats back to inventory.
7.  **Completion**: Saga marked as `completed`, emits `saga.cancel.event.completed`.
