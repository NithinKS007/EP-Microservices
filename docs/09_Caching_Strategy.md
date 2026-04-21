# 09 Caching Strategy

This document defines what data is safe to cache, what must never be cached, and the invalidation rules that keep the system consistent.

## 1. Current Redis Usage

| Use Case | Service | Key Pattern | Purpose |
| --- | --- | --- | --- |
| Email existence cache | auth-service | `ep:auth:email:exists:{email}` | Fast email uniqueness check |
| Bloom filter | auth-service | `ep:auth:email:bloom` | Probabilistic pre-filter |
| Event metadata cache | event-service | `ep:event:meta:{eventId}` | Cacheable read-through for event display data |
| Distributed cron lock | booking-service | `cron:{serviceName}:{jobName}` | Prevents duplicate cron executions |
| Rate limiting store | api-gateway | Rate limit keys | Request throttling |

## 2. What Must NEVER Be Cached

These entities have multiple concurrent mutation paths across services. Caching them would create stale reads that break business logic.

### Seat Availability

**Mutation paths:** 6 (lockSeats, confirmSeats, releaseSeats, bulkReleaseSeatsForBookings, BookingExpiryJob cron, Kafka payment failure consumer)

**Why it's dangerous:** A stale cache showing `AVAILABLE` when a seat is `LOCKED` bypasses the advisory lock mechanism in `BookingService.create()`, causing double-booking and financial loss.

### Booking Status

**Mutation paths:** 8 (create, confirmBooking, cancelBooking, expireBooking, updateBookingStatus via gRPC, bulkCancelBookings via saga, BookingExpiryJob cron, Kafka payment consumers)

**Why it's dangerous:** The saga's `executeInitiatePaymentSaga()` reads booking status to decide whether to proceed with payment. A stale `PENDING` when the booking is actually `EXPIRED` would lock seats and create payments for dead bookings.

### Payment Status

**Mutation paths:** 6 (handlePaymentCaptured webhook, handlePaymentFailed webhook, updatePaymentStatus via gRPC, bulkRefundPayments, bulkFailPayments, refundPayment REST)

**Why it's dangerous:** `cancelBooking()` reads payment status to decide whether to refund. Stale cache returning `INITIATED` when actually `SUCCESS` = missed refund = financial loss. Webhooks arrive asynchronously from Razorpay with no predictable timing.

### Event Status

**Mutation paths:** 2 (cancelEvent REST → saga, markEventCancelledFromSaga gRPC)

**Why it's risky:** `lockSeats()` validates `event.status === "ACTIVE"` before locking. A stale cache showing `ACTIVE` when actually `CANCELLED` allows seats to be locked on a cancelled event.

### Saga State

**Why:** Real-time orchestration data. Every saga step reads and writes saga state. Caching would immediately desync the step progression.

## 3. Safe Caches

### Email Existence Cache

**Key:** `ep:auth:email:exists:{normalized_email}`
**TTL:** 24 hours
**Strategy:** Write-through — set on signup, checked before signup

| Event | Action |
| --- | --- |
| User created | `SET ep:auth:email:exists:{email} "1" EX 86400` |
| Email check (cache hit) | Return `available: false` |
| Email check (cache miss) | Fall through to gRPC → DB |
| Redis down | Fall through to gRPC → DB (never assume available) |

**Safety:** Email addresses are immutable once created. Users are never deleted. 24h TTL provides self-healing if Redis state drifts.

### Event Metadata Cache

**Key:** `ep:event:meta:{eventId}`
**TTL:** 60 seconds
**Strategy:** Cache-aside — populate on read, invalidate on write

**What's cached:** Full event object (name, eventDate, venueName, description, status)
**What's NOT cached:** Seat data (never cached separately)

| Event | Action |
| --- | --- |
| `findEventById()` cache miss | Fetch from DB, `SET ep:event:meta:{id} JSON EX 60` |
| `findEventById()` cache hit | Return parsed JSON, skip DB |
| `updateEvent()` | After DB write, `DEL ep:event:meta:{id}` |
| `deleteEvent()` | After DB write, `DEL ep:event:meta:{id}` |
| `markEventCancelledFromSaga()` | After DB write, `DEL ep:event:meta:{id}` |
| Redis down | Skip cache entirely, read from DB |
| Cache write failure | Log warning, response is not blocked |
| Cache invalidation failure | Log warning, TTL will clean up within 60s |

**Safety:** Event metadata is modified only by admins (rare). Worst case with a 60s stale read: user sees the old event name for one minute. No financial or booking integrity impact.

## 4. Design Principles

### Optional Cache Pattern

All cache operations follow the "optional cache" pattern:
- **Read path:** Check Redis → if miss or error, fall through to DB
- **Write path:** Write to DB → then invalidate cache (best-effort)
- **Redis down:** Service continues operating without cache, no errors surfaced to users
- **Cache failure:** Logged as warning, never thrown as an error

### Why Invalidate Instead of Update

Cache entries are **deleted** on mutation, not updated. Reasons:
1. **Simpler:** No need to serialize the new state and write it
2. **Safer:** Avoids race conditions where two concurrent updates overwrite each other
3. **Self-healing:** Next read will populate the cache from the authoritative DB

### Why Short TTLs

Even with active invalidation, TTLs provide a safety net:
- If invalidation fails (Redis temporarily down), stale data expires automatically
- Prevents unbounded memory growth from orphaned keys
- 60s for events — event metadata changes are rare, so cache hits are frequent

## 5. Source Files

| File | Change |
| --- | --- |
| `auth-service/src/services/email.availability.service.ts` | TTL fix + safe fallback |
| `event-service/src/services/event.service.ts` | Cache-aside + invalidation |
| `event-service/src/config/env.config.ts` | Redis + cache config |
| `event-service/src/container.ts` | RedisService registration |
| `event-service/src/server.ts` | Redis lifecycle |
