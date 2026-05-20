# Backend API

`packages/api` is the current backend runtime.

## App Structure

- framework: Express 5
- auth: device bearer (`Authorization: Bearer device.<secret>`) or magic-link session JWT
- cookies: HTTP-only `distrotv_session` for dashboard sessions
- CORS: credentials enabled, origins from `ALLOWED_ORIGINS`
- security headers: Helmet
- logs: Pino + `pino-http`
- rate limit: Upstash Redis, fail-open on Redis errors
- `DISTRO_ENV` bundle: `local | staging | prod` resolves api/web/email URLs

## Layered Architecture

All routes follow a clean layered pattern:

| Layer      | Location          | Responsibility                                                                                                                                    |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes     | `routes/*.ts`     | HTTP wiring only — parse params, call validator, call service, pass errors to `next()`                                                            |
| Validators | `validators/*.ts` | Pure input validation — type coercion, format checks, field constraints. Throws `ValidationError`.                                                |
| Services   | `services/*.ts`   | Business logic — state machines, budget validation, FK checks, transactions. Throws typed errors.                                                 |
| Errors     | `errors/*.ts`     | `ApiError` hierarchy (`ValidationError`, `NotFoundError`, `ConflictError`, `StateError`, `ForbiddenError`) + centralized error handler middleware |
| Lib        | `lib/*.ts`        | Low-level utilities — Redis pacing algorithms, JWT, logging                                                                                       |

The centralized error handler (`errors/error-handler.ts`) catches all typed errors and PostgreSQL constraint violations (`23505` unique, `23503` FK, `23514` CHECK) and serializes them to the standard `{ error: "snake_case" }` format. Route handlers never format error responses directly.

State transitions use `db.transaction()` with `SELECT ... FOR UPDATE` for atomicity.

## Startup Behavior

On process start:

- load env from `dotenv/config`
- probe DB and Redis in parallel
- exit if DB probe fails
- continue if Redis probe fails (warn only)
- listen on `PORT`
- track open sockets for graceful shutdown

## Routes

## `GET /health`

Purpose:
health endpoint with component-level DB and Redis status.

Behavior:

- not behind the global limiter
- probes DB and Redis on request
- returns `200` if DB is healthy
- returns `503` if DB is unhealthy
- returns overall `status: "ok"` only when DB and Redis are both healthy
- returns overall `status: "degraded"` when Redis is unhealthy but DB is healthy

Response shape:

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-04-15T00:00:00.000Z",
  "components": {
    "db": { "status": "ok" },
    "redis": { "status": "ok" }
  }
}
```

## Auth — Magic-Link

### `POST /auth/magic-link/request`

Purpose:
request a magic-link sign-in email for a registered user.

Auth: none

### `GET /auth/magic-link/verify`

Purpose:
consume the magic-link token and issue a session JWT.

Auth: none

### `POST /auth/logout`

Purpose:
revoke all non-revoked refresh tokens for the authenticated user.

Auth: bearer token

Response:

```json
{
  "ok": true
}
```

## `POST /auth/exchange`

Purpose:
exchange one-time Redis code for bearer tokens (used by CLI pairing flow).

Request body:

```json
{
  "code": "hex-string"
}
```

Success response:

```json
{
  "token": "jwt",
  "refresh_token": "hex-string"
}
```

Errors:

- `400 missing_code`
- `401 invalid_or_expired_code`

## `POST /auth/refresh`

Purpose:
rotate refresh token and issue a new access token.

Request body:

```json
{
  "refresh_token": "hex-string"
}
```

Behavior:

- rate limited by `refreshLimiter`
- hashes the provided refresh token
- atomically revokes the current row if it is still active
- detects token reuse and revokes the full token family
- rejects expired tokens
- inserts successor refresh token in the same family
- issues a new access token using stored user identity

Success response:

```json
{
  "token": "jwt",
  "refresh_token": "new-hex-string"
}
```

Errors:

- `401 missing_refresh_token`
- `401 invalid_refresh_token`
- `401 refresh_token_expired`
- `401 refresh_token_reuse_detected`
- `500 internal_error`

## `GET /me`

Purpose:
return the authenticated user's core profile. Used by the CLI to populate `~/.distro/config.json` and to render `distro status`.

Auth: bearer token

Success response:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "avatarUrl": null
}
```

Errors:

- `401 missing_token`
- `401 token_expired`
- `401 invalid_token`
- `404 user_not_found`

## `GET /me/preferences`

Return the authenticated user's preferences row. Lazy-creates the row on first call.

Auth: bearer token

Response:

```json
{
  "preferences": {
    "quietHoursStart": null,
    "quietHoursEnd": null,
    "tzOffsetMinutes": -330,
    "idleSensitivityMs": 10000,
    "nightMode": false,
    "channelMode": "balanced",
    "newsTopics": [],
    "updatedAt": "2026-05-01T00:00:00.000Z"
  }
}
```

## `PUT /me/preferences`

Upsert the current user's preferences row. Only keys present in the body are written; unspecified columns preserve prior values.

**Request body** (all keys optional):

```json
{
  "quietHoursStart": 22,
  "quietHoursEnd": 7,
  "tzOffsetMinutes": -330,
  "idleSensitivityMs": 10000,
  "nightMode": false,
  "channelMode": "balanced",
  "newsTopics": []
}
```

**Validation:**

- `quietHoursStart` / `quietHoursEnd` — integer in `[0, 1439]` or null; must be set or unset together.
- `tzOffsetMinutes` — integer in `[-720, 840]`.
- `idleSensitivityMs` — integer in `[1000, 300000]`.
- `channelMode` — one of `news_only | news_heavy | balanced | ticker_heavy | ticker_only`.
- `newsTopics` — array of valid `NewsTopic` enum values.
- Unknown top-level keys → 400 `{ error: "unknown_field" }`.

**Response (200):** same shape as `GET /me/preferences`.

## `POST /devices`

Purpose:
register or refresh a device record for the authenticated user.

Auth: bearer token

Request body:

```json
{
  "machineIdHash": "64-char hex",
  "os": "darwin | linux | win32",
  "ideType": "terminal | vscode | cursor",
  "deviceName": "optional string"
}
```

Behavior:

- validates machine ID hash format
- validates allowed OS values
- validates allowed IDE values
- validates device name length when present
- inserts a new device or updates an existing row on `userId + machineIdHash`
- updates `lastHeartbeat` on every registration
- only overwrites `deviceName` if the caller explicitly sends it

Success response:

```json
{
  "device": {
    "id": "uuid",
    "userId": "uuid",
    "deviceName": "host-name",
    "os": "darwin",
    "ideType": "terminal",
    "lastHeartbeat": "2026-04-15T00:00:00.000Z",
    "createdAt": "2026-04-15T00:00:00.000Z"
  }
}
```

Errors:

- `400 invalid_machine_id_hash`
- `400 invalid_os`
- `400 invalid_ide_type`
- `400 invalid_device_name`
- `500 internal_error`

## Channels, Watchlists, Alerts

### `GET /me/channels`

Returns user's subscribed channel list with priority order.

### `PUT /me/channels`

Replace user's channel subscriptions.

### `GET /me/watchlists`

Returns user's watchlists (up to 3).

### `PUT /me/watchlists`

Replace user's watchlists. Body: `[{ name, tickers: [{ symbol, assetClass }] }]`.

### `GET /me/alerts`

Returns user's price alerts.

### `PUT /me/alerts`

Replace user's alerts. Body: `[{ scope, symbol, thresholdPct }]`.

## News + Reading Endpoints

- `GET /me/content/next?deviceId=<uuid>&n=<int>` — returns `{ items: SlotContent[] }` based on user's `channelMode`. The daemon batches this every 8 minutes (slot-cache TTL).
- `POST /me/reading` — body: `{ newsId, source, headline, url, score }`. Idempotent on `(user_id, news_id)`; returns 201 if new, 200 if existing.
- `GET /me/reading?limit=N` — returns `{ items, hasMore }`. Default + max limit 100 in MVP.
- `DELETE /me/reading/:id` — 204 on success, 404 if not owned.
- `GET /me/news-stats` — returns `{ thisWeek, lastWeek }`. 60s in-memory cache.

## Slot Impression Ingest

### `POST /ingest`

Purpose:
batch-record news impressions from the CLI sync loop.

Auth: bearer token. Rate-limited: 300 requests / 60s keyed by `deviceId`.

Body-parser limit: 1mb scoped to this route only.

Request body:

```json
{
  "newsImpressions": [
    {
      "newsId": "hn:123",
      "source": "hn",
      "deviceId": "uuid",
      "durationMs": 5000,
      "result": "completed",
      "openedUrl": false,
      "saved": false
    }
  ]
}
```

Response gains `newsImpressions: [{ ok, newsId, error? }]`.

## Ticker Endpoints

- `GET /me/ticker/sparklines?symbols=AAPL,BTC-USD` — returns `{ sparklines: SparklineDto[] }` with 7-day price history for each symbol.
- `GET /me/ticker/quotes?symbols=AAPL,BTC-USD` — returns live quote data.

## Admin Routes

All admin routes are protected by the `requireAdmin` middleware (timing-safe `X-Admin-Secret` header check). Use a dedicated IP-keyed `adminLimiter` (30 requests / 60s).

### `GET /admin/dashboard`

Purpose:
platform-wide aggregates for the M7 admin dashboard.

Auth: admin secret

Response includes active user counts, news impression totals, slot rotation health, and system status.

### `GET /admin/users`

Purpose:
list signed-up users for operator visibility.

Auth: admin secret

Query params: `limit` (default 20, max 100), `offset` (default 0)

Response:

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "createdAt": "2026-04-01T10:00:00.000Z"
    }
  ],
  "total": 37,
  "limit": 20,
  "offset": 0
}
```

### `POST /invites`

Purpose:
generate a batch of single-use invite codes.

Auth: admin secret

Request body:

```json
{ "count": 10 }
```

`count` must be an integer in `[1, 100]`. Codes are 10-character strings drawn from an unambiguous alphabet (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`), stored in `invite_codes.code` (`varchar(20)`, unique). Collisions are retried up to 3 times before failing.

Success: `201` with `{ invites: [{ id, code, usedBy, usedAt, createdAt }] }`

Errors:

- `400 invalid_count`

### `GET /invites`

Purpose:
list unused invite codes.

Auth: admin secret

Query params: `limit`, `offset`

Response: `{ invites, limit, offset }` (unused rows only, newest first).

## Rate Limit Tiers

- `global`: 100 requests / 60s by IP
- `public`: 20 requests / 60s by IP
- `auth`: 10 requests / 60s by IP
- `refresh`: 20 requests / 60s by IP
- `user`: 60 requests / 60s by user ID
- `sensitive`: 3 requests / 1h by user ID
- `admin`: 30 requests / 60s by IP

Headers set on limited routes:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` on `429`
