# Email Availability Flow With Native Redis Bloom

This document explains the email availability flow as it is currently implemented in this repo.

Goal:
- show the exact read/write path used today
- explain how native Redis Bloom is used
- clarify where Redis is only an optimization and where the database still matters

## 1. Problem

When a user signs up, the system needs to answer:

`Does this email already exist?`

The current implementation uses a layered approach so repeated availability checks do not always hit the database first.

Current layers:

1. Native Redis Bloom filter
2. Exact Redis email-exists cache
3. user-service / database lookup

The database is still the final source of truth for writes.

## 2. Files Involved

### Auth-service

- `auth-service/src/services/auth.service.ts`
- `auth-service/src/services/email.availability.service.ts`
- `auth-service/src/config/env.config.ts`
- `auth-service/src/server.ts`

### Shared utils

- `utils/src/redis.service.ts`

### Infra

- `docker-compose.yml`

## 3. Redis Runtime

The compose file pins Redis to:

- `redis:8.6.2-alpine`

The current implementation uses native Bloom commands exposed by Redis:

- `BF.RESERVE`
- `BF.ADD`
- `BF.EXISTS`

No manual hash math or `SETBIT` / `GETBIT` logic is used in the email availability service anymore.

## 4. Environment Variables

These values are read from `auth-service/.env` through `auth-service/src/config/env.config.ts`.

```env
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis0nks0password@123
REDIS_DB=0

AUTH_EMAIL_EXISTS_CACHE_PREFIX=auth:email:exists
AUTH_EMAIL_BLOOM_KEY=auth:email:bloom
AUTH_EMAIL_BLOOM_ERROR_RATE=0.001
AUTH_EMAIL_BLOOM_CAPACITY=1000000
AUTH_EMAIL_BLOOM_EXPANSION=2
```

Meaning:

- `AUTH_EMAIL_EXISTS_CACHE_PREFIX`
  Prefix for exact email confirmation keys.

- `AUTH_EMAIL_BLOOM_KEY`
  Key name for the native Redis Bloom filter.

- `AUTH_EMAIL_BLOOM_ERROR_RATE`
  Target false-positive rate used during `BF.RESERVE`.

- `AUTH_EMAIL_BLOOM_CAPACITY`
  Initial filter capacity used during `BF.RESERVE`.

- `AUTH_EMAIL_BLOOM_EXPANSION`
  Expansion factor for the scalable Bloom filter.

## 5. Shared Redis Wrapper

`utils/src/redis.service.ts` now exposes native Bloom helpers:

- `bfReserve(key, errorRate, capacity, options)`
- `bfAdd(key, item)`
- `bfExists(key, item)`

Important behavior:

- `bfReserve` treats `ERR item exists` as a safe, idempotent case and returns `false`
- `bfAdd` and `bfExists` convert Redis responses into booleans
- the older `setBit` / `getBit` helpers still exist in the shared utility, but the email availability flow does not use them

## 6. Bloom Initialization

`EmailAvailabilityService.initializeBloomFilter()` is responsible for reserving the Bloom filter.

What it does:

- skips work if Redis is not connected
- caches successful initialization in memory
- uses `BF.RESERVE` with:
  - `AUTH_EMAIL_BLOOM_KEY`
  - `AUTH_EMAIL_BLOOM_ERROR_RATE`
  - `AUTH_EMAIL_BLOOM_CAPACITY`
  - `EXPANSION AUTH_EMAIL_BLOOM_EXPANSION`

Why it is idempotent:

- if the filter already exists, Redis returns `ERR item exists`
- `RedisService.bfReserve()` treats that as expected instead of failing

When it runs:

- during auth-service startup after Redis connects
- before read checks
- before write-side Bloom updates

## 7. Read Flow

The public read entrypoint is:

- `AuthService.checkEmailAvailability(email)`

That delegates to:

- `EmailAvailabilityService.checkEmailAvailability(email)`

Current flow:

1. Normalize the email with `trim().toLowerCase()`
2. Build the exact cache key:
   `auth:email:exists:<normalizedEmail>`
3. If Redis is connected, ensure the Bloom filter is reserved
4. Run `BF.EXISTS auth:email:bloom <normalizedEmail>`
5. Read the exact Redis cache key
6. If the exact Redis key is `"1"`, return unavailable immediately
7. Otherwise call `userServiceGrpcClient.findUserByEmail(...)`
8. If the database says the user exists, call `rememberExistingEmail(...)`
9. Return the result

Returned sources currently used by the implementation:

- `redis_exact_cache`
- `database`
- `fallback`

Meaning of `bloomMaybePresent`:

- `true`
  Redis Bloom says the email may be present

- `false`
  Redis Bloom says the email is not present

- `null`
  Redis Bloom was not used because the request fell back out of the Redis path

## 8. Double-Check Pattern In Current Code

The current implementation follows this order inside the Redis-backed path:

1. native Bloom check first
2. exact Redis cache second
3. database last

What this means:

- Bloom is used as the cheapest maybe/not-present signal
- exact Redis cache is used as a strong positive confirmation
- database still provides the exact answer whenever the exact Redis cache is missing

This is the current implementation behavior, even when Bloom returns `false`.

## 9. Write Flow

The write-side warm-up happens after user creation succeeds.

Entry point:

- `AuthService.signup(...)`

Current flow:

1. `checkEmailAvailability(email)` runs first
2. if available, auth-service calls user-service to create the user
3. after create succeeds, auth-service calls `rememberExistingEmail(email)`

`rememberExistingEmail(email)` does this:

1. normalize the email
2. ensure the Bloom filter is reserved
3. set the exact Redis key to `"1"`
4. call `BF.ADD auth:email:bloom <normalizedEmail>`

Why the order matters:

- the database write happens before Redis cache/Bloom warming
- this avoids marking an email as taken when the DB insert fails

## 10. Redis Data Layout

### Exact cache key

Pattern:

- `auth:email:exists:<normalizedEmail>`

Value:

- `"1"`

Meaning:

- exact confirmation that this email is known to exist

### Bloom key

Pattern:

- `auth:email:bloom`

Stored as:

- native Redis Bloom filter

Meaning:

- probabilistic membership signal for existing emails

## 11. Current Fallback Behavior

If the Redis-backed path throws inside `checkEmailAvailability(...)`, the service currently:

- logs a warning
- returns:
  - `available: true`
  - `source: "fallback"`
  - `bloomMaybePresent: null`

Important note:

- in the current implementation, this fallback path does not perform a database lookup before returning

This section describes the code exactly as it exists today.

## 12. What Changed From The Older Manual Bloom Version

The older documentation described a manual Bloom implementation based on:

- local hashing with `sha256` and `md5`
- derived bit offsets
- Redis `SETBIT`
- Redis `GETBIT`
- size/hash-count env vars

That is no longer the active implementation.

The current implementation uses:

- `BF.RESERVE`
- `BF.ADD`
- `BF.EXISTS`
- error-rate / capacity / expansion env vars

## 13. Production Notes

What is already good in the current implementation:

- Bloom reservation is idempotent
- exact Redis cache is kept separate from Bloom
- signup warms Redis only after DB success
- the DB-backed user creation path still protects true uniqueness

What is still not covered by the current code:

- rebuilding the Bloom filter from existing users on startup
- background re-sync or event-driven sync
- Bloom/cache metrics
- exact database fallback in the Redis-error path
