# 07 Circuit Breaker Architecture

This document reviews the current circuit breaker usage in this project and defines the production-grade pattern we should follow going forward.

## Executive Summary

Short answer: the current usage is directionally correct, but it is **not enough to say "the circuit breaker pattern is correct everywhere"**.

What is good now:

- outbound synchronous gRPC calls are now protected much more consistently
- external payment-provider calls already use circuit breakers
- outbox and consumer retries already include exponential backoff and jitter
- the API Gateway now has both `timeout` and `proxyTimeout`
- breaker instances in the normal HTTP route flow are long-lived enough to accumulate state

What is still important to understand:

- a circuit breaker is only one part of resilience
- PostgreSQL should **not** be wrapped in a generic breaker
- Kafka producer and consumer loops should **not** be wrapped in a generic breaker
- Redis should usually use fail-open behavior for optional features, not a blanket breaker
- fallback behavior must be explicit and safe per endpoint
- thresholds must be policy-driven, not hand-tuned ad hoc in every file

## Current Project Audit

### What the repo does today

The project uses:

- API Gateway as HTTP reverse proxy
- synchronous service-to-service gRPC between microservices
- Kafka for asynchronous settlement, outbox, and saga execution
- PostgreSQL through Prisma in each service
- Redis for rate limiting, distributed cron locks, and auth email-availability acceleration
- Razorpay as a third-party dependency

### Where breakers are correctly used

These are good breaker targets because they are remote, synchronous, and latency-sensitive:

- `payment-service/src/services/payment.service.ts`
  `payment.razorpay.create_order`
  `payment.razorpay.refund`
- outbound gRPC wrappers in:
  - `auth-service/src/grpc/user.client.ts`
  - `booking-service/src/grpc/event.client.ts`
  - `booking-service/src/grpc/payment.client.ts`
  - `event-service/src/grpc/booking.client.ts`
  - `event-service/src/grpc/payment.client.ts`
  - `event-service/src/grpc/saga.client.ts`
  - `payment-service/src/grpc/booking.client.ts`
  - `payment-service/src/grpc/event.client.ts`
  - `payment-service/src/grpc/saga.client.ts`
  - `payment-service/src/grpc/user.client.ts`
  - `saga-orchestrator-service/src/grpc/booking.client.ts`
  - `saga-orchestrator-service/src/grpc/event.client.ts`
  - `saga-orchestrator-service/src/grpc/payment.client.ts`

### Where breakers should NOT be the main pattern

#### PostgreSQL

Do not put a generic circuit breaker in front of Prisma queries.

Why:

- database failures are often local capacity or pool issues, not remote dependency flapping
- opening a breaker on the DB usually turns partial slowness into full application outage
- DB traffic often includes critical writes where "fail fast" is not the right control

Use instead:

- connection pooling
- query timeouts
- transaction time limits
- indexed queries
- backpressure
- admission control
- read/write separation if needed later

#### Kafka

Do not place one generic breaker around Kafka producer or consumer loops.

Why:

- Kafka is already retry-oriented and partitioned
- producer and consumer behavior should be controlled with backoff, DLQ, idempotency, and bounded concurrency
- a breaker at that layer often hides the real issue and causes backlog growth

Use instead:

- producer acks and broker timeout tuning
- consumer backoff
- DLQ
- idempotent processing
- bounded in-flight work

#### Redis

Redis is mixed:

- for optional cache lookups and Bloom checks, fail-open is good
- for rate limiter and distributed job locks, correctness matters more than a generic breaker

This repo already has the right intuition in `auth-service/src/services/email.availability.service.ts`:

- cache/Bloom problems degrade gracefully
- final user creation still relies on the authoritative user-service write path

That is a better pattern than putting a global Redis breaker everywhere.

## Anti-Patterns Checked

### 1. Global breaker

Not found as a major problem in the repo.

Good:

- breakers are named per dependency and operation
- examples:
  - `payment.event.confirm_seats`
  - `saga.booking.find_by_event`
  - `auth.user.find_by_email`

This is the right direction.

### 2. Missing timeout handling

This was a real issue before.

Current status after the refactor:

- shared unary gRPC deadline helper exists in `utils/src/grpc/grpc.client.ts`
- gRPC deadline handling is now much more consistent
- gateway upstream timeout protection exists in `api-gateway/src/config/service.proxy.ts`

Still recommended:

- add explicit Prisma-side query timeout strategy at the DB/session level
- keep external HTTP timeouts stricter than user-facing SLAs

### 3. Retry storm risk

Current status:

- gRPC wrappers do **not** auto-retry, which is good
- Kafka consumers retry with exponential backoff
- outbox workers retry with exponential backoff and jitter

Main rule:

- do not combine transport retries, consumer retries, gateway retries, and circuit-breaker half-open probes without a budget

The current code is mostly safe because synchronous gRPC calls are not auto-retried.

### 4. Missing fallback strategy

This is still a design decision area, not a place for generic defaults.

Safe fallbacks:

- optional cache read -> bypass cache
- availability check endpoint -> degrade to best-effort with authoritative write still protected
- optional enrichment fields -> return partial data if the product allows it

Unsafe fallbacks:

- payment creation
- booking status mutation
- seat lock/confirm/release
- refund execution
- authentication and authorization decisions

## Production-Grade Design

### Core principle

Use a breaker only for **outbound synchronous dependency calls** where all of the following are true:

1. The dependency can fail independently.
2. The caller is otherwise healthy.
3. Waiting longer makes the system worse.
4. Failing fast or degrading is better than hanging.

### Breaker placement

Place breakers at the **client boundary**, not deep inside business code.

Good:

- gRPC client wrapper classes
- external HTTP client wrapper
- payment-provider integration boundary

Avoid:

- one breaker for an entire service
- one breaker shared across unrelated endpoints
- one breaker around repository or ORM methods

## Recommended Policy Model

Use central presets from `utils/src/resilience.policy.ts`.

Profiles:

- `internalQuery`
- `internalCommand`
- `externalRead`
- `externalWrite`
- `optionalCache`

Why this model works:

- teams do not hard-code random thresholds in every file
- read vs write traffic get different timeout and reset behavior
- external providers get tighter concurrency bulkheads

## Circuit States

The shared utility in `utils/src/circuit.breaker.ts` supports:

- `CLOSED`
- `OPEN`
- `HALF_OPEN`

The exported handle also exposes:

- breaker name
- current state
- current stats

This is enough for:

- logs
- health dashboards
- admin diagnostics

## Failure Handling Strategy

### Fail fast

Fail fast when the operation is authoritative and no safe substitute exists.

Use fail-fast for:

- payment provider order creation
- refund execution
- seat lock
- seat confirm
- booking status updates
- user lookup in signin or password reset

### Fallback

Fallback only when the product can still behave safely.

Use fallback for:

- optional cache reads
- optional enrichment reads
- non-critical notifications

Examples in this repo:

- refund email lookup in `payment-service/src/services/payment.service.ts`
  notification failure is logged and does not roll back the refund
- email availability in `auth-service/src/services/email.availability.service.ts`
  the read path degrades, but the final authoritative write still protects correctness

### Default responses vs graceful degradation

Prefer:

- partial response with missing enrichment
- explicit `dependencyUnavailable: true`
- empty optional list
- "retry later" for non-critical UI paths

Avoid:

- fake success on write operations
- pretending a payment mutation happened when it did not
- silently skipping inventory mutations

## Database Consideration

Circuit breakers are not ideal for PostgreSQL.

### Why

- DB issues are often saturation, locking, slow queries, or pool exhaustion
- a breaker opens based on recent failures and can create a hard outage even after load normalizes
- critical write paths do not usually have safe fallback values

### What to do instead

1. Connection pooling
2. Query timeout
3. Statement timeout
4. Slow query detection
5. Backpressure
6. Load shedding at the API layer

### Recommended DB controls for this repo

- set `statement_timeout` and optionally `idle_in_transaction_session_timeout`
- keep Prisma pool bounded
- reject excessive concurrent expensive queries early
- add per-query timeout policy for admin/reporting endpoints before customer checkout paths

## Concurrency and Load Handling

### Prevent retry storms

Do:

- keep retries at one layer
- use exponential backoff with jitter
- let the breaker fail fast when dependency health is bad

Do not:

- retry in gateway + service + SDK + consumer at the same time

### Thundering herd

The breaker helper now supports `capacity` through Opossum.

That acts like a local bulkhead:

- expensive external calls do not consume infinite concurrency
- when the dependency is slow, excess requests are rejected quickly instead of piling up

This is especially important for:

- `payment.razorpay.create_order`
- `payment.razorpay.refund`

### Bulkhead guidance

Use smaller capacities for:

- third-party write APIs
- expensive refund paths
- slow admin-only operations

Use larger capacities for:

- internal read gRPC traffic

## Architecture Diagram

### Request flow and breaker placement

```text
                        +----------------------+
Client  ---> HTTP ----> |      API Gateway     |
                        |  timeout/proxyTimeout|
                        +----------+-----------+
                                   |
                -------------------------------------------------
                |               |               |               |
                v               v               v               v
         +-------------+ +-------------+ +-------------+ +-------------+
         | Auth Svc    | | Booking Svc | | Payment Svc | | Event Svc   |
         +------+------+ +------+------+ +------+------+ +------+------+
                |               |               |               |
                | gRPC client    | gRPC client   | gRPC + HTTP   | gRPC client
                | breakers       | breakers      | breakers      | breakers
                v               v               v               v
          +-----------+   +-----------+   +-----------+   +-----------+
          | User Svc  |   | Event Svc |   | Saga Svc  |   | Booking   |
          +-----------+   +-----------+   +-----------+   +-----------+
                                |               |
                                |               +-------------------------+
                                |                                         |
                                v                                         v
                         +--------------+                          +---------------+
                         | Razorpay API |                          | Payment Svc   |
                         +--------------+                          +---------------+
```

### Fallback paths

```text
Optional Cache Read

Request
  |
  v
Service -> Redis/Bloom
  |         |
  |         +-- timeout / unavailable
  |
  +--> fallback: bypass cache -> authoritative read path


Critical Payment Write

Request
  |
  v
Service -> Payment Provider
  |         |
  |         +-- timeout / unavailable
  |
  +--> fail fast -> return error -> caller retries later
```

### Data-plane control summary

```text
HTTP ingress:        timeout + proxyTimeout + rate limiting
Internal gRPC:       per-endpoint breaker + deadlines
External HTTP:       per-endpoint breaker + deadline + bulkhead
Kafka async flows:   retry + jitter + DLQ + idempotency
Redis optional use:  fail-open where safe
PostgreSQL:          pool + query timeout + backpressure
```

## Current Shared Code

Shared production utilities added or improved:

- `utils/src/circuit.breaker.ts`
  shared breaker with state, stats, fallback hook, warmup, bulkhead capacity
- `utils/src/resilience.policy.ts`
  policy presets for internal and external dependency classes
- `utils/src/grpc/grpc.client.ts`
  shared unary gRPC deadline helper
- `utils/src/http.client.ts`
  reusable HTTP client with deadline enforcement
- `utils/src/grpc/grpc.error.mapper.ts`
  maps deadline and unavailable cases cleanly

Gateway timeout hardening:

- `api-gateway/src/config/service.proxy.ts`

External provider bulkhead example:

- `payment-service/src/services/payment.service.ts`

## Example gRPC Usage

```ts
import {
  createCircuitBreaker,
  createGrpcClient,
  executeUnaryGrpcCall,
  findCircuitBreakerPolicy,
} from "../../../utils/src";

export class UserServiceGrpcClient {
  private readonly client = createGrpcClient(UserServiceClient, "user:50051");

  private readonly findUserBreaker = createCircuitBreaker<[FindUserByIdRequest], FindUserByIdResponse>({
    name: "auth.user.find_by_id",
    ...findCircuitBreakerPolicy("internalQuery", {
      timeoutMs: 3000,
    }),
    action: (data) =>
      executeUnaryGrpcCall({
        timeoutMs: 3000,
        invoke: (metadata, options, callback) =>
          this.client.findUserById(data, metadata, options, callback),
      }),
  });

  findUserById(data: FindUserByIdRequest) {
    return this.findUserBreaker.fire(data);
  }
}
```

## Example HTTP Usage

```ts
import {
  createCircuitBreaker,
  executeHttpRequest,
  findCircuitBreakerPolicy,
} from "../../../utils/src";

const providerHealthBreaker = createCircuitBreaker<[string], { status: string }>({
  name: "payment.provider.healthcheck",
  ...findCircuitBreakerPolicy("externalRead", {
    timeoutMs: 2500,
    capacity: 20,
  }),
  fallback: async () => ({ status: "degraded" }),
  action: async (url) =>
    executeHttpRequest({
      url,
      timeoutMs: 2500,
      parseResponse: (response) => response.json() as Promise<{ status: string }>,
    }),
});
```

## Edge Cases

### Partial failures

Example:

- payment success consumer updates booking
- event seat confirmation fails

What saves you:

- retryable async consumer
- idempotent downstream operations
- DLQ for terminal visibility

### Cascading failures

Breakers help because:

- callers stop waiting on a dying dependency
- threads and sockets are preserved
- pressure does not amplify endlessly downstream

But only if:

- you also have deadlines
- you avoid multi-layer retries

### Network latency spikes

Timeouts must be short enough to protect callers but not so short that normal p99 latency constantly trips the breaker.

Practical rule:

- internal reads: tighter
- internal writes: moderate
- third-party writes: longest but still bounded

### Cold starts

Allow warm-up on breakers so one startup failure does not open the circuit immediately.

That is now supported in the shared breaker utility and used in the central policy model.

## Final Assessment For This Repo

Is the pattern now working?

- yes, the breaker pattern is now functioning correctly for the outbound synchronous dependency boundaries it wraps
- no, it should still **not** be described as something that should wrap every dependency everywhere

Senior recommendation:

1. Keep breakers on outbound gRPC and third-party HTTP.
2. Do not add generic breakers around PostgreSQL.
3. Keep Kafka on retry + DLQ + idempotency, not generic breakers.
4. Use Redis fail-open only where the feature is optional.
5. Standardize future breaker thresholds through `utils/src/resilience.policy.ts`.
6. Add metrics export later for breaker state and stats so SREs can alert on persistent open circuits.
