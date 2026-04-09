# Email Availability Flow With Redis + Bloom Filter

This document explains the full email availability implementation added to this project.

Goal:
- help a developer understand the exact flow in this repo
- explain why Redis and Bloom filter are used together
- explain why the database is still required
- make it easy to re-build the same design in another project

## 1. Problem We Are Solving

When a user signs up, the system must answer:

`Does this email already exist?`

In a very small app, we would just query the database directly every time.

At scale, that becomes expensive because:
- signup forms may call "check availability" many times
- frontend apps may validate on every blur or keystroke
- repeated exact existence checks can add unnecessary database traffic

So this project now uses a layered read path:

1. Redis exact cache
2. Bloom filter stored in Redis bitset
3. user-service / database fallback

The database is still the final truth.

## 2. Where This Fits In This Project

This feature belongs mainly to the user-auth flow because:
- [user.prisma](EVENT-BOOKING-PLATFORM-MICROSERVICES\user-service\prisma\schemas\user.prisma) has `email String @unique`
- `auth-service` already orchestrates signup and signin
- `user-service` owns user persistence

So the responsibility split is:

- `auth-service`: fast read orchestration and signup orchestration
- `user-service`: exact user lookup and actual database insert
- PostgreSQL: final uniqueness guarantee
- Redis: fast cache + Bloom bitset storage

## 3. Files Involved

### Auth-service files

- [auth.routes.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\routes\auth.routes.ts)
- [auth.controller.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\controllers\auth.controller.ts)
- [auth.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\auth.service.ts)
- [email.availability.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\email.availability.service.ts)
- [container.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\container.ts)
- [server.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\server.ts)
- [env.config.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\config\env.config.ts)
- [auth.dto.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\dtos\auth.dto.ts)

### Shared utils

- [redis.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\utils\src\redis.service.ts)
- [index.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\utils\src\index.ts)

### User-service files

- [user.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\user-service\src\services\user.service.ts)
- [user.repository.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\user-service\src\repositories\user.repository.ts)
- [user.server.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\user-service\src\grpc\user.server.ts)

### Infra

- [docker-compose.yml](EVENT-BOOKING-PLATFORM-MICROSERVICES\docker-compose.yml)

## 4. New Route

The public route is:

`GET /api/v1/auth/email/check?email=test@example.com`

Defined in:
- [auth.routes.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\routes\auth.routes.ts)

This route is useful for:
- signup page pre-check
- frontend validation before submit
- testing the Redis/Bloom/DB layered flow without actually creating a user

## 5. Full Read Flow

This is the step-by-step execution path when a client checks an email.

### Step 1: Route receives request

File:
- [auth.routes.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\routes\auth.routes.ts)

Flow:
- request enters `GET /email/check`
- forwarded to `AuthController.checkEmailAvailability`

### Step 2: Controller validates input

File:
- [auth.controller.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\controllers\auth.controller.ts)

Flow:
- validates `req.query.email` using `CheckEmailAvailabilityRequestDto`
- calls `authService.checkEmailAvailability(email)`

Why:
- controller should validate transport input
- business logic should remain in services

### Step 3: Auth service delegates to email availability service

File:
- [auth.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\auth.service.ts)

Flow:
- checks email presence
- delegates to `EmailAvailabilityService`

Why:
- keeps auth orchestration readable
- avoids duplicating Redis/Bloom logic in multiple auth methods

### Step 4: Normalize the email

File:
- [email.availability.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\email.availability.service.ts)

Flow:
- trims spaces
- lowercases the email

Why:
- email checks must be consistent
- `Test@Email.com` and `test@email.com` should map to the same cache and Bloom positions

### Step 5: Exact Redis cache check

Files:
- [email.availability.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\email.availability.service.ts)
- [redis.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\utils\src\redis.service.ts)

Key format:
- `auth:email:exists:<normalizedEmail>`

Flow:
- if Redis key value is `"1"`, email is definitely taken
- return immediately

Why:
- this is the fastest exact positive path
- no Bloom math needed
- no database call needed

### Step 6: Bloom filter check

File:
- [email.availability.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\email.availability.service.ts)

Flow:
- hash the normalized email twice:
  - `sha256`
  - `md5`
- derive multiple Bloom positions from those hashes
- read those positions from the Redis bitset key

Bloom bitset key:
- `auth:email:bloom`

What the result means:
- if any bit is `0`: email is definitely not in the Bloom filter
- if all bits are `1`: email might be in the Bloom filter

Why this is useful:
- Bloom filter stores existence signatures in a tiny memory footprint
- much cheaper than storing every email in an exact set for large datasets

### Step 7: Exact fallback to user-service / DB

Files:
- [email.availability.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\email.availability.service.ts)
- [user.client.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\grpc\user.client.ts)
- [user.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\user-service\src\services\user.service.ts)
- [user.repository.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\user-service\src\repositories\user.repository.ts)

Flow:
- auth-service calls user-service gRPC `findUserByEmail`
- user-service queries Postgres
- returns exact answer

Why:
- database is the source of truth
- caches and Bloom filters optimize reads but do not replace correctness

### Step 8: Warm the fast path if the email exists

File:
- [email.availability.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\email.availability.service.ts)

Flow:
- if DB confirms the email exists:
  - set exact Redis key
  - set Bloom bits

Why:
- next time the same email is checked, the read path becomes cheaper

## 6. Full Signup Write Flow

This is the path when a new user signs up.

### Step 1: Signup request reaches auth-service

Files:
- [auth.routes.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\routes\auth.routes.ts)
- [auth.controller.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\controllers\auth.controller.ts)

Flow:
- request is validated
- forwarded to `AuthService.signup`

### Step 2: Email availability is checked first

File:
- [auth.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\auth.service.ts)

Flow:
- calls `emailAvailabilityService.checkEmailAvailability(email)`
- if unavailable, throws `ConflictError`

Why:
- prevents obvious duplicate signups early
- reduces load on the actual insert path

### Step 3: User is created in user-service

Files:
- [auth.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\auth.service.ts)
- [user.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\user-service\src\services\user.service.ts)

Flow:
- password is hashed in auth-service
- user-service persists the user

Why user-service still matters:
- user-service owns user writes
- Postgres unique constraint is the final guard

### Step 4: Database uniqueness still protects correctness

File:
- [user.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\user-service\src\services\user.service.ts)

Flow:
- if Prisma throws `P2002`, service throws `ConflictError("Email already exists")`

Why:
- even if two requests race at the same time
- even if cache/Bloom are stale
- the DB still prevents duplicates

This is a critical real-world pattern.

### Step 5: After successful write, cache and Bloom are updated

Files:
- [auth.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\auth.service.ts)
- [email.availability.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\email.availability.service.ts)

Flow:
- after create succeeds
- call `rememberExistingEmail(email)`

Why order matters:
- if we updated Redis/Bloom before the DB write and DB write failed,
  we would poison the cache with a false "already exists"

## 7. Redis Data Layout

### Exact cache key

Pattern:
- `auth:email:exists:<normalizedEmail>`

Example:
- `auth:email:exists:alice@example.com`

Value:
- `"1"`

Meaning:
- exact confirmation that this email is already known to exist

### Bloom filter key

Pattern:
- `auth:email:bloom`

Stored as:
- Redis bitset

Meaning:
- compact existence signature for many emails

## 8. Why Bloom Filter Was Merged Into EmailAvailabilityService

This was done intentionally for this repo because:
- only one feature currently uses the Bloom logic
- a separate `BloomFilterService` added one more abstraction layer without much reuse yet
- keeping hashing + bitset logic in the email service makes the feature easier to learn

This is better for practice right now because a new developer can open one file:
- [email.availability.service.ts](EVENT-BOOKING-PLATFORM-MICROSERVICES\auth-service\src\services\email.availability.service.ts)

and understand:
- normalization
- exact Redis check
- Bloom hashing
- Bloom bit reads
- DB fallback
- cache warming

all in one place.

If later multiple features use Bloom filters, then extracting a reusable Bloom utility would make sense again.

## 9. Environment Variables Needed

These should be present in `auth-service/.env`.

```env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis0nks0password@123
REDIS_DB=0

AUTH_EMAIL_EXISTS_CACHE_PREFIX=auth:email:exists
AUTH_EMAIL_BLOOM_KEY=auth:email:bloom
AUTH_EMAIL_BLOOM_SIZE_BITS=1000000
AUTH_EMAIL_BLOOM_HASH_COUNT=7
```

### Meaning of each variable

- `REDIS_HOST`
  Redis host used by auth-service.

- `REDIS_PORT`
  Redis port.

- `REDIS_PASSWORD`
  Redis password. Must match the Redis container setup.

- `REDIS_DB`
  Logical Redis DB number used by auth-service.

- `AUTH_EMAIL_EXISTS_CACHE_PREFIX`
  Prefix for exact email-exists keys.

- `AUTH_EMAIL_BLOOM_KEY`
  Redis key that stores the Bloom bitset.

- `AUTH_EMAIL_BLOOM_SIZE_BITS`
  Size of the Bloom bit array.
  Larger size usually means fewer false positives but more memory use.

- `AUTH_EMAIL_BLOOM_HASH_COUNT`
  Number of bit positions used per email.
  More hashes may reduce false positives up to a point, but also increases read/write work.

## 10. Why This Is Still Not The Final Production Version

This implementation is a strong practice version, but not the final large-scale version yet.

What is still missing for a fuller production Bloom setup:
- startup rebuild from all users in DB
- periodic rebuild job
- or CDC / Kafka event-driven sync from user-service to auth-service
- metrics for:
  - Redis hit rate
  - Bloom maybe rate
  - DB fallback count
  - false positive rate

So the current state is:
- architecture is correct
- read path is layered correctly
- DB correctness is preserved
- Bloom is used as a cheap signal, not as a source of truth

## 11. Can This Pattern Be Used Elsewhere In This Project?

### Good next candidate

`event-service`

Schema:
- [event.prisma](EVENT-BOOKING-PLATFORM-MICROSERVICES\event-service\prisma\schemas\event.prisma)

Unique rule:
- `@@unique([name, venueName, eventDate])`

How to adapt:
- create normalized key like:
  `event:<date>:<venue>:<name>`
- exact Redis key for known existing composite identifiers
- Bloom filter for cheap maybe/not-present pre-check
- DB fallback in event-service

### Not a good candidate

`booking-service` idempotency key

Why not:
- idempotency needs exact correctness, not probabilistic pre-checking
- exact Redis key or distributed lock is the better design

### Also not very useful

`seat` uniqueness under one event

Why not:
- seats are usually much smaller per event
- exact Redis Set is easier than Bloom filter

## 12. Rebuild This In Another Project


1. Choose one exact unique field
2. Normalize it consistently
3. Store exact positive cache in Redis
4. Store Bloom bitset in Redis
5. Read flow:
   - exact Redis
   - Bloom
   - DB fallback
6. Write flow:
   - DB insert first
   - then exact Redis + Bloom update
7. Keep DB unique constraint
8. Add rebuild/sync if you later want stronger Bloom-driven optimizations

