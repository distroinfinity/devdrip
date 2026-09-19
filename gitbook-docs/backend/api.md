# Backend API

`packages/api` is the current backend runtime.

## App Structure

- framework: Express 5
- auth: bearer JWT
- cookies: used only for GitHub OAuth state
- CORS: credentials enabled, origins from `ALLOWED_ORIGINS`
- security headers: Helmet
- logs: Pino + `pino-http`
- rate limit: Upstash Redis, fail-open on Redis errors

## Layered Architecture

Admin routes (advertisers, campaigns, creatives) follow a clean layered pattern:

| Layer      | Location          | Responsibility                                                                                                                                    |
| ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes     | `routes/*.ts`     | HTTP wiring only — parse params, call validator, call service, pass errors to `next()`                                                            |
| Validators | `validators/*.ts` | Pure input validation — type coercion, format checks, field constraints. Throws `ValidationError`.                                                |
| Services   | `services/*.ts`   | Business logic — state machines, budget validation, FK checks, transactions. Throws typed errors.                                                 |
| Errors     | `errors/*.ts`     | `ApiError` hierarchy (`ValidationError`, `NotFoundError`, `ConflictError`, `StateError`, `ForbiddenError`) + centralized error handler middleware |
| Lib        | `lib/*.ts`        | Low-level utilities — Redis pacing algorithms, JWT, logging                                                                                       |

The centralized error handler (`errors/error-handler.ts`) catches all typed errors and PostgreSQL constraint violations (`23505` unique, `23503` FK, `23514` CHECK) and serializes them to the standard `{ error: "snake_case" }` format. Route handlers never format error responses directly.

State transitions use `db.transaction()` with `SELECT ... FOR UPDATE` for atomicity. Budget updates also use transactions to prevent stale reads.

## Startup Behavior

On process start:

- load env from `dotenv/config`
- probe DB and Redis in parallel
- exit if DB probe fails
- continue if Redis probe fails (warn only)
- bootstrap Carbon system campaign (deterministic UUID advertiser + campaign, idempotent)
- schedule stale Carbon creative cleanup (every 12 hours)
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

## `GET /auth/github/redirect`

Purpose:
start GitHub OAuth. Used by both the web dashboard and the `devdrip auth` CLI.

Query params:

- `cli_port` (optional) — integer in `[54321, 54330]`. When present and valid, the callback later redirects the browser to `http://localhost:<cli_port>/callback` instead of `CLIENT_REDIRECT_URL`. Out-of-range or non-numeric values are silently ignored.

Behavior:

- rate limited by `authLimiter`
- generates random state
- stores state in `gh_oauth_state` cookie
- if a valid `cli_port` is supplied, stores `{ cliPort }` in Redis at `auth:state:<state>` with 10-minute TTL
- redirects to GitHub with `read:user user:email`

## `GET /auth/github/callback`

Purpose:
complete GitHub OAuth and prepare token exchange.

Behavior:

- validates query `state` against cookie
- consumes the Redis entry at `auth:state:<state>` to recover `cliPort` (if any)
- if GitHub returned `?error` (e.g. user denied consent), forwards that error to the resolved redirect target
- validates `code`
- exchanges code for GitHub token
- fetches GitHub profile
- fetches primary language using recent repos
- resolves email from profile, email API, or GitHub noreply fallback
- upserts user by `githubId`
- inserts a refresh token row
- stores access token and refresh token behind a one-time Redis code with 60 second TTL
- redirects the browser to `http://localhost:<cliPort>/callback?code=<exchangeCode>` when `cliPort` is present, otherwise `CLIENT_REDIRECT_URL?code=<exchangeCode>`

Failure redirects (target same as above — CLI port when known, web otherwise):

- `?error=invalid_state` (always web — state is untrusted so we don't look up the CLI port)
- `?error=missing_code`
- `?error=access_denied` (or any other error GitHub returned)
- `?error=user_creation_failed`
- `?error=auth_failed`

## `POST /auth/exchange`

Purpose:
exchange one-time Redis code for bearer tokens.

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

Engineering note:

- the code already flags a remaining transactional race in refresh rotation

## `POST /auth/logout`

Purpose:
revoke all non-revoked refresh tokens for the authenticated user.

Auth:

- requires bearer token

Response:

```json
{
  "ok": true
}
```

## `GET /me`

Purpose:
return the authenticated user's core profile. Used by the CLI to populate `~/.devdrip/config.json` after sign-in and to render `devdrip status`.

Auth:

- requires bearer token

Success response:

```json
{
  "id": "uuid",
  "githubLogin": "login",
  "email": "user@example.com",
  "avatarUrl": "https://avatars.githubusercontent.com/u/123"
}
```

`githubLogin` and `avatarUrl` may be `null` for users created outside the GitHub OAuth flow.

Errors:

- `401 missing_token`
- `401 token_expired`
- `401 invalid_token`
- `404 user_not_found`

### PUT /me/preferences

Upsert the current user's preferences row. Only keys present in the body are written; unspecified columns preserve prior values.

**Request body** (all keys optional):

```json
{
  "blockedCategories": ["developer-recruiting"],
  "tzOffsetMinutes": -330
}
```

**Validation:**

- `blockedCategories` — array; each element must be a valid `AdCategory` enum value.
- `tzOffsetMinutes` — integer in `[-720, 840]`.
- Unknown top-level keys → 400 `{ error: "unknown_field" }`.

**Response (200):**

```json
{
  "preferences": {
    "blockedCategories": ["developer-recruiting"],
    "enabledSurfaces": ["terminal-tv"],
    "maxPerHour": 8,
    "maxPerDay": 60,
    "quietHoursStart": null,
    "quietHoursEnd": null,
    "tzOffsetMinutes": -330,
    "idleSensitivityMs": 10000
  }
}
```

**Scope note (S4-06).** This endpoint is the `PUT` half only. `GET /preferences`, the daemon's 30-min sync loop, and the dashboard preferences UI remain in S4-06.

## `POST /devices`

Purpose:
register or refresh a device record for the authenticated user.

Auth:

- requires bearer token

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

## Admin Routes

All campaign management routes are protected by the `requireAdmin` middleware. This checks for an `X-Admin-Secret` header matching the `ADMIN_SECRET` environment variable. These routes use a dedicated IP-keyed `adminLimiter` (30 requests / 60s) instead of user-keyed limiters.

## `POST /advertisers`

Purpose:
create an advertiser record.

Auth: admin secret

Request body:

```json
{
  "name": "Acme Corp",
  "contactEmail": "ads@acme.com",
  "companyName": "Acme Corp",
  "billingInfo": {
    "method": "stripe",
    "stripeCustomerId": "cus_123"
  }
}
```

Validation:

- `name`: required, 1-255 chars
- `contactEmail`: required, email format, unique
- `companyName`: optional, max 255
- `billingInfo`: optional object. `method` must be `stripe|crypto|invoice`. `stripe` requires `stripeCustomerId`, `crypto` requires `walletAddress`

Success: `201` with `{ advertiser }` shape

Errors:

- `400 invalid_name`
- `400 invalid_contact_email`
- `400 invalid_billing_method`
- `400 stripe_customer_id_required`
- `400 wallet_address_required`
- `409 email_already_exists`

## `GET /advertisers`

Purpose:
list advertisers with pagination.

Auth: admin secret

Query params: `limit` (default 20, max 100), `offset` (default 0)

Response:

```json
{
  "advertisers": [...],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

## `GET /advertisers/:id`

Purpose:
get a single advertiser.

Auth: admin secret

Response: `{ advertiser }` or `404 advertiser_not_found`

## `PATCH /advertisers/:id`

Purpose:
update advertiser fields. At least one field required. Same per-field validation as create.

Auth: admin secret

Errors:

- `400 no_fields_to_update`
- `404 advertiser_not_found`
- `409 email_already_exists`

## `DELETE /advertisers/:id`

Purpose:
delete an advertiser and cascade its campaigns/creatives.

Auth: admin secret

Guard: rejects delete if the advertiser has any non-draft, non-completed campaigns (active or paused). Also catches FK constraint violations if cascade would hit impressions with historical data.

Errors:

- `404 advertiser_not_found`
- `409 has_active_campaigns`
- `409 has_historical_data` (cascade blocked by impressions FK RESTRICT)

## `POST /campaigns`

Purpose:
create a campaign in `draft` status.

Auth: admin secret

Request body:

```json
{
  "advertiserId": "uuid",
  "name": "Dev Tools Q2",
  "budgetTotal": 100.0,
  "budgetDaily": 10.0,
  "cpmRate": 2.5,
  "targetCategories": ["developer-tools"],
  "targetSurfaces": ["terminal-tv"],
  "targetingRules": { "geoAllow": ["US"] },
  "pacingStrategy": "even",
  "startsAt": "2026-04-15T00:00:00Z",
  "endsAt": "2026-07-15T00:00:00Z"
}
```

Validation:

- `advertiserId`: required UUID, must exist
- `name`: required, 1-255 chars
- `budgetTotal`: required, > 0
- `budgetDaily`: required, > 0, must be <= `budgetTotal`
- `cpmRate`: required, > 0
- `targetCategories`: optional, each must be valid `AdCategory`
- `targetSurfaces`: optional, each must be valid `AdSurface`
- `targetingRules`: optional JSONB
- `pacingStrategy`: optional, `even|front_loaded|asap`, default `even`
- `startsAt`, `endsAt`: optional ISO8601. If both present, `endsAt > startsAt`

Success: `201` with `{ campaign }`

Errors:

- `400 invalid_*` for each field
- `400 budget_daily_exceeds_total`
- `404 advertiser_not_found`

## `GET /campaigns`

Purpose:
list campaigns with pagination and filters.

Auth: admin secret

Query params: `limit`, `offset`, `status` (filter by campaign status), `advertiserId` (filter by advertiser)

Response: `{ campaigns, total, limit, offset }`

## `GET /campaigns/:id`

Purpose:
get a single campaign.

Auth: admin secret

Response: `{ campaign }` or `404 campaign_not_found`

## `PATCH /campaigns/:id`

Purpose:
update campaign fields. Rejects `status` changes (use the dedicated status endpoint).

Auth: admin secret

Budget guards:

- cannot lower `budgetTotal` below current `budgetSpent`
- `budgetDaily` must remain <= `budgetTotal`

Errors:

- `400 no_fields_to_update`
- `400 budget_total_below_spent`
- `400 budget_daily_exceeds_total`
- `404 campaign_not_found`
- `422 use_status_endpoint` (if `status` field is sent)

## `PATCH /campaigns/:id/status`

Purpose:
transition campaign status through the state machine.

Auth: admin secret

Request body:

```json
{ "status": "active" }
```

State machine:

```
draft     → [active]
active    → [paused, completed]
paused    → [active, completed]
completed → []  (terminal)
```

Guards before activation (`→ active`):

1. campaign must have at least 1 active creative
2. `endsAt` must be in the future (if set)
3. `budgetSpent < budgetTotal`

Errors:

- `422 invalid_status_transition` (with `from` and `to` fields)
- `422 no_active_creatives`
- `422 campaign_ended`
- `422 budget_exhausted`
- `404 campaign_not_found`

## `DELETE /campaigns/:id`

Purpose:
delete a campaign. Only `draft` campaigns can be deleted.

Auth: admin secret

Errors:

- `404 campaign_not_found`
- `409 only_draft_deletable`

## `GET /campaigns/:id/stats`

Purpose:
return aggregated stats for a campaign, combining DB impression/click counts with live Redis spend data.

Auth: admin secret

Response:

```json
{
  "campaignId": "uuid",
  "totalImpressions": 150,
  "completedImpressions": 120,
  "clicks": 8,
  "ctr": 0.0667,
  "budgetSpent": 0.3,
  "dailySpendToday": 0.05,
  "hourlySpendNow": 0.01
}
```

Note: `budgetSpent` is the DB-reconciled historical total (excludes today). Today's live spend appears in `dailySpendToday`. Sum both for true all-time spend.

## `POST /campaigns/:campaignId/creatives`

Purpose:
create a creative for a campaign.

Auth: admin secret

Request body:

```json
{
  "headline": "Ship faster with Turbo CI",
  "body": "Cut build times by 70%.",
  "ctaText": "Try free",
  "ctaUrl": "https://example.com/turbo",
  "format": "text",
  "surface": "terminal-tv",
  "category": "developer-tools",
  "source": "direct",
  "cpmRate": 2.5
}
```

Validation:

- `headline`: required, 1-60 chars
- `body`: optional, max 140
- `ctaText`: optional, max 30
- `ctaUrl`: optional, max 2048, must be valid HTTPS URL (parsed with `new URL()`)
- `format`: required, `text|banner|sponsored-link`
- `surface`: required, valid `AdSurface`
- `category`: required, valid `AdCategory`
- `source`: required, valid `AdSource`
- `cpmRate`: required, > 0
- `impressionBeaconUrl`, `clickTrackingUrl`: optional, must be valid HTTPS URL
- `externalCampaignId`, `externalCreativeId`: optional, max 255

Success: `201` with `{ creative }`

Errors:

- `400 invalid_*` for each field
- `404 campaign_not_found`

## `GET /campaigns/:campaignId/creatives`

Purpose:
list creatives for a campaign with pagination and optional `isActive` filter.

Auth: admin secret

Query params: `limit`, `offset`, `isActive` (`true|false`)

Response: `{ creatives, total, limit, offset }`

## `GET /campaigns/:campaignId/creatives/:id`

Purpose:
get a single creative. Validates ownership against the campaign.

Auth: admin secret

## `PATCH /campaigns/:campaignId/creatives/:id`

Purpose:
update creative fields including `isActive` toggle for soft-deactivation.

Auth: admin secret

## `DELETE /campaigns/:campaignId/creatives/:id`

Purpose:
hard delete a creative.

Guard: impressions FK is `ON DELETE RESTRICT`. If the creative has served impressions, the delete will be rejected.

Errors:

- `404 creative_not_found`
- `409 creative_has_impressions` (with `hint: "deactivate_instead"`)

## `GET /admin/stats`

Purpose:
platform-wide aggregates for the admin CLI `stats` command.

Auth: admin secret

Response:

```json
{
  "today": {
    "impressionsCount": 12,
    "spendUsdc": 0.0084,
    "earningsUsdc": 0.0059
  },
  "lifetime": {
    "impressionsCount": 4210,
    "spendUsdc": 2.9456,
    "earningsUsdc": 2.0619
  },
  "activeCampaignsCount": 3
}
```

`today` is aggregated from the start of the current UTC day. `spendUsdc` sums `impressions.earned_amount`; `earningsUsdc` sums `earnings_ledger.amount_usdc`. `activeCampaignsCount` is a live `status = 'active'` count and lives outside the today/lifetime blocks because it is not date-filtered.

## `GET /admin/users`

Purpose:
list signed-up users with lifetime earnings for the admin CLI `user list` command.

Auth: admin secret

Query params: `limit` (default 20, max 100), `offset` (default 0)

Response:

```json
{
  "users": [
    {
      "id": "uuid",
      "githubLogin": "octocat",
      "email": "octo@example.com",
      "hasWallet": true,
      "lifetimeEarningsUsdc": 1.2041,
      "createdAt": "2026-04-01T10:00:00.000Z"
    }
  ],
  "total": 37,
  "limit": 20,
  "offset": 0
}
```

`lifetimeEarningsUsdc` is the sum of `earnings_ledger.amount_usdc` via `LEFT JOIN` (never null). The route is read-only; there is intentionally no create/update/delete for users here — GitHub OAuth owns that lifecycle.

## `GET /admin/payouts`

Purpose:
list payouts for operator visibility.

Auth: admin secret

Query params: `status` (`pending | processing | confirmed | failed`), `limit`, `offset`

Response: `{ payouts, total, limit, offset }` where each row has `id`, `userId`, `amountUsdc`, `walletAddress`, `status`, `txHash`, `failureReason`, `createdAt`, `confirmedAt`.

## `PATCH /admin/payouts/:id/status`

Purpose:
operator override for a stuck payout.

Auth: admin secret

Request body:

```json
{
  "status": "confirmed",
  "txHash": "0x...",
  "failureReason": null
}
```

Rules:

- target `status` must be `confirmed` or `failed` — the payment worker owns forward progress (`pending → processing`).
- `confirmed` requires `txHash`.
- `failed` accepts an optional `failureReason` (max 500 chars).
- transitions from terminal states (`confirmed`, `failed`) are rejected.
- row is locked with `SELECT ... FOR UPDATE` to avoid racing the worker.

Errors:

- `400 invalid_status` (target not in `confirmed | failed`)
- `400 invalid_tx_hash` (when target is `confirmed` and `txHash` missing)
- `404 payout_not_found`
- `409 tx_hash_already_used`
- `422 invalid_status_transition` (with `from` and `to` fields)

## `POST /invites`

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

## `GET /invites`

Purpose:
list unused invite codes.

Auth: admin secret

Query params: `limit`, `offset`

Response: `{ invites, limit, offset }` (unused rows only, newest first).

## Ad Serving Endpoints

These routes power the CLI ad pipeline. All require bearer token auth and use the user-keyed rate limiter.

All ad serving endpoints share the same waterfall behavior:

- validates device ownership (device must belong to the authenticated user)
- loads user preferences (blocked categories, enabled surfaces, quiet hours, frequency caps)
- runs the ad delivery waterfall with shared gates checked once before any provider:
  1. surface gate (is this surface enabled in user prefs?)
  2. quiet hours check (user-local time via `tzOffsetMinutes`)
  3. frequency caps (Redis counters — per-surface hourly, total hourly, total daily)
- waterfall provider order:
  1. **Carbon Ads** (primary) — fetches from `@carbonads/sdk` with 3s timeout, upserts ephemeral creative row, fail-open (returns `[]` on any error)
  2. **Manual campaigns** (fallback) — 4-stage selection pipeline: DB query → targeting filter → budget pre-screen → creative rotation
- if Carbon fills all requested slots, manual provider is not called
- if Carbon returns fewer than requested, manual fills the remaining slots
- issues a short-lived, one-time `delivery_token` per returned ad; `/impressions` must consume it exactly once
- returns `204 No Content` when no ads are available from any source

### `GET /ads/next`

Purpose:
fetch a single ad for a device. Primary endpoint for the daemon's ad-fetch loop.

Auth: bearer token

Query params: `deviceId` (UUID), `surface` (AdSurface enum)

Example: `GET /ads/next?deviceId=uuid&surface=terminal-tv`

Response (`200`):

```json
{
  "ad": {
    "id": "creative-uuid",
    "campaign_id": "campaign-uuid",
    "format": "text",
    "headline": "Ship faster with Turbo CI",
    "body": "Cut build times by 70%.",
    "url": "https://example.com/turbo",
    "display_time_ms": 8000,
    "delivery_token": "jwt",
    "impression_beacon_url": "https://srv.carbonads.net/ads/viewable/x/abc",
    "click_tracking_url": "https://srv.carbonads.net/ads/click/x/abc"
  }
}
```

Returns `204 No Content` when no ads from any provider.

Errors:

- `400 invalid_device_id`, `400 invalid_surface`
- `403 device_not_owned`
- `404 device`

### `GET /ads/batch`

Purpose:
fetch up to 10 ads for pre-caching. Used by the daemon to fill the local ad cache.

Auth: bearer token

Query params: `deviceId` (UUID), `surface` (AdSurface enum), `count` (1-10, default 5)

Example: `GET /ads/batch?deviceId=uuid&surface=terminal-tv&count=5`

Response (`200`):

```json
{
  "ads": [
    {
      "id": "creative-uuid",
      "campaign_id": "campaign-uuid",
      "format": "text",
      "headline": "Ship faster with Turbo CI",
      "body": "Cut build times by 70%.",
      "url": "https://example.com/turbo",
      "display_time_ms": 8000,
      "delivery_token": "jwt",
      "impression_beacon_url": "https://srv.carbonads.net/ads/viewable/x/abc",
      "click_tracking_url": "https://srv.carbonads.net/ads/click/x/abc"
    }
  ]
}
```

Returns `204 No Content` when no ads from any provider.

Errors:

- `400 invalid_device_id`, `400 invalid_surface`, `400 invalid_count`
- `403 device_not_owned`
- `404 device`

### `POST /ads/next`

Purpose:
backward-compatible ad fetch endpoint. Supports count up to 10.

Auth: bearer token

Request body:

```json
{
  "deviceId": "uuid",
  "surface": "terminal-tv",
  "count": 1
}
```

Preserves the original response contract for backward compatibility:

- Returns `200` with `{ "ads": [] }` when no ads (not 204)
- Uses camelCase field names (`campaignId`, `displayTimeMs`, `deliveryToken`) — raw `ServedAdPayload` objects, not the snake_case mapper used by GET endpoints
- Beacon URLs included as camelCase: `impressionBeaconUrl`, `clickTrackingUrl`

New clients should use `GET /ads/next` or `GET /ads/batch` instead.

Errors:

- `400 invalid_device_id`, `400 invalid_surface`, `400 invalid_count`
- `403 device_not_owned`
- `404 device`

### `POST /ingest`

Purpose:
batch-record impressions and clicks from the CLI sync loop.

Auth: bearer token (`requireAuth`). Rate-limited: 300 requests / 60s keyed by `deviceId` peeked from the first item's `deliveryToken` (`machineLimiter`).

Body-parser limit: 1mb scoped to this route only.

Request body:

```json
{
  "impressions": [{ "deliveryToken": "eyJ..." }],
  "clicks": [{ "deliveryToken": "eyJ..." }]
}
```

- combined cap: 500 items. Either array may be empty (but not both).

Rate-limit key extraction: a pre-handler `peekDeliveryToken(firstItem.deliveryToken)` verifies the JWT signature only (no nonce consume) to read `device_id` and stash it on `res.locals`. If neither array is populated, the request passes through and the validation layer returns 400.

Processing order: impressions first. The server builds an in-memory `jti → impressionId` map for this batch, then processes clicks using the map or falling back to `SELECT id FROM impressions WHERE delivery_jti = ?` for clicks whose parent landed in an earlier request.

Grace-accept: tokens up to 24h past expiry are accepted but inserted with `result = 'expired'`, `earnedAmount = 0`. Preserves analytics signal for devices that slept overnight.

Anti-replay: `delivery_jti UNIQUE` constraint is the authoritative guard. The Redis nonce is the early-reject optimization.

Response (always 2xx unless catastrophic):

```json
{
  "impressions": [
    {
      "ok": true,
      "deliveryToken": "...",
      "impressionId": "uuid",
      "earnedAmount": 0.00056,
      "result": "completed"
    },
    { "ok": false, "deliveryToken": "...", "error": "campaign_budget_exhausted" }
  ],
  "clicks": [
    { "ok": true, "deliveryToken": "...", "clickId": "uuid", "earningsDelta": 0 },
    { "ok": false, "deliveryToken": "...", "error": "impression_not_synced" }
  ]
}
```

**Error codes:**

| Code                                | Type               | Meaning                                                                                        |
| ----------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `empty_ingest`                      | 400                | both arrays empty                                                                              |
| `too_many_items`                    | 400                | combined count > 500                                                                           |
| `invalid_or_expired_delivery_token` | per-item terminal  | signature bad or nonce already consumed; replay means a prior request already succeeded        |
| `delivery_token_too_old`            | per-item terminal  | token issued > 24h ago (past grace window)                                                     |
| `delivery_not_owned`                | per-item terminal  | token belongs to a different user's device                                                     |
| `impression_already_recorded`       | per-item terminal  | `delivery_jti` UNIQUE constraint violation                                                     |
| `click_already_recorded`            | per-item terminal  | replay; parent click already persisted                                                         |
| `campaign_budget_exhausted`         | per-item transient | campaign may reactivate; CLI retries next cycle                                                |
| `impression_not_synced`             | per-item transient | click's parent jti not found yet; transient until 24h from click creation, then CLI tombstones |
| `rate_limit_exceeded`               | transient          | machine rate limit hit; CLI backs off                                                          |
| `internal_error`                    | transient          | unexpected server error                                                                        |

Terminal per-item errors → CLI marks `synced_at = -1` (tombstone, stops retrying). Transient → CLI leaves `synced_at = NULL` for next cycle.

## News + Reading endpoints

- `GET /me/content/next?deviceId=<uuid>&n=<int>&surface=<terminal-tv>` — returns `{ items: SlotContent[] }` based on user's `channelMode`. The daemon batches this every 8 minutes (slot-cache TTL).
- `POST /me/reading` — body: `{ newsId, source, headline, url, score }`. Idempotent on `(user_id, news_id)`; returns 201 if new, 200 if existing.
- `GET /me/reading?limit=N` — returns `{ items, hasMore }`. Default + max limit 100 in MVP.
- `DELETE /me/reading/:id` — 204 on success, 404 if not owned.
- `GET /me/news-stats` — returns `{ thisWeek, lastWeek }`. 60s in-memory cache.

## /ingest extension

Body now also accepts:

```json
{
  "impressions": [...],
  "clicks": [...],
  "newsImpressions": [
    { "newsId", "source", "deviceId", "durationMs", "result", "openedUrl", "saved" }
  ]
}
```

Response gains `newsImpressions: [{ ok, newsId, error? }]`. Earnings-summary cache invalidation only fires when `impressions.length > 0`.

### `GET /me/earnings/summary`

Purpose:
return the authenticated user's earnings summary.

Auth: bearer token

Response cached in Redis for 60s at key `earnings:summary:{userId}`. Cache is best-effort invalidated on `/ingest` writes for that user and on payout.

Response:

```json
{
  "balance": 2.34,
  "today": 0.034,
  "week": 0.18,
  "month": 0.98,
  "allTime": 2.34,
  "streakDays": 4,
  "totalImpressions": 312,
  "totalClicks": 8,
  "topCategories": [
    { "category": "developer-tools", "amountUsdc": 1.2 },
    { "category": "cloud-infra", "amountUsdc": 0.78 },
    { "category": "databases", "amountUsdc": 0.36 }
  ]
}
```

Field notes:

- `balance` = sum of `earnings_ledger.amount_usdc` for user − sum of completed `payouts` for user. Both pending and confirmed earnings count toward balance; a payout subtracts.
- `today` / `week` / `month` anchored in the user's local day via `preferences.tzOffsetMinutes` so the dashboard matches the terminal toast.
- `streakDays`: consecutive local-days with ≥1 completed impression up to and including today.
- `topCategories`: top 3 by all-time earned USDC.

### `GET /me/analytics/impressions`

Purpose:
day-bucketed impression analytics for the authenticated user.

Auth: bearer token

Query params:

| Param      | Default       | Notes                                  |
| ---------- | ------------- | -------------------------------------- |
| `from`     | 30d ago (ISO) | inclusive lower bound                  |
| `to`       | today (ISO)   | inclusive upper bound                  |
| `source`   | —             | optional filter                        |
| `category` | —             | optional filter (see limitation below) |
| `result`   | —             | optional filter                        |

Response:

```json
{
  "series": [
    { "date": "2026-04-22", "impressions": 22, "completed": 18, "clicks": 1, "earned": 0.01008 }
  ],
  "totals": {
    "impressions": 312,
    "completed": 260,
    "skipped": 40,
    "expired": 10,
    "interrupted": 2,
    "clicks": 8,
    "earned": 0.145,
    "ctr": 0.0308
  },
  "breakdowns": {
    "bySource": [{ "source": "carbon", "impressions": 250, "earned": 0.12 }],
    "byCategory": [{ "category": "developer-tools", "impressions": 180, "earned": 0.09 }],
    "byResult": [{ "result": "completed", "impressions": 260 }]
  }
}
```

- CTR denominator: completed impressions only (excludes skipped/expired/interrupted).
- Day buckets use user's `tzOffsetMinutes`.
- Scoped to `deviceId IN (user's devices)`.
- Known limitation: the `category` filter narrows `series` and `totals` but not `bySource` or `byResult` breakdowns. Follow-up ticket needed if the dashboard requires fully-filtered breakdowns.

### `GET /admin/reports/campaigns`

Purpose:
list campaigns with pacing and spend for admin reporting.

Auth: admin secret

Query params: `status?`, `source?`, `from?`, `to?`

Response (array):

```json
[
  {
    "campaignId": "uuid",
    "name": "Linear Q2",
    "advertiserId": "uuid",
    "advertiserName": "Linear",
    "source": "direct",
    "impressions": 1200,
    "completed": 1050,
    "clicks": 9,
    "ctr": 0.0086,
    "spend": 6.25,
    "budgetTotal": 50.0,
    "remaining": 43.75,
    "pacing": { "status": "on_track", "ratio": 1.02 }
  }
]
```

**Pacing formula:**

```
expected_by_now = budgetTotal * (elapsed / duration)
  where elapsed  = now - coalesce(startsAt, createdAt)
        duration = coalesce(endsAt, startsAt + 30d) - startsAt
ratio = actualSpend / expected_by_now
status:
  ratio < 0.85         → "underpacing"
  0.85 ≤ ratio ≤ 1.15  → "on_track"
  ratio > 1.15         → "overpacing"
  budget = 0 or expected ≤ 0 → "unknown"
```

No `startsAt` → fallback to `createdAt`. No `endsAt` → 30-day synthetic duration.

Note: `listCampaignReports` runs a per-campaign subquery loop (N+1). Acceptable at MVP scale (dozens of campaigns); revisit if the admin dashboard pages or shows slow queries.

### `GET /admin/reports/campaigns/:id`

Purpose:
single campaign detail with day-bucketed series.

Auth: admin secret

Response: same shape as a single entry from `GET /admin/reports/campaigns` plus a `series` array (`{ date, impressions, clicks, spend }` per day).

Note: internally re-runs `listCampaignReports()` and filters in memory — double-scan vs. a targeted query. Acceptable at MVP; refactor when admin traffic grows.

### `GET /admin/reports/advertisers/:id`

Purpose:
per-advertiser rollup with all campaigns.

Auth: admin secret

Response:

```json
{
  "advertiser": { "id": "uuid", "name": "Linear" },
  "totals": {
    "impressions": 3200,
    "clicks": 22,
    "ctr": 0.0069,
    "spend": 18.2,
    "budgetTotal": 150.0
  },
  "campaigns": []
}
```

`campaigns` has the same shape as `GET /admin/reports/campaigns` entries.

Note: internally re-runs `listCampaignReports()` with no filter then filters in memory. Same double-scan caveat as the single campaign report.

## AdProvider Interface

The `AdProvider` interface in `@devdrip/shared` defines a pluggable ad selection abstraction:

```typescript
interface AdProvider {
  readonly name: string
  fetchAds(request: AdRequest): Promise<AdPayload[]>
}
```

Two implementations exist:

- **`CarbonAdProvider`** (primary) — fetches from `@carbonads/sdk`, translates to our schema, upserts ephemeral creative rows with dedup on `(source, externalCreativeId)`. Fail-open: any error (SDK timeout, DB failure) returns `[]` and falls through to the next provider. Carbon ads use a deterministic system campaign with near-infinite budget so they pass through the standard impression/earnings pipeline unchanged.
- **`ManualAdProvider`** (fallback) — queries internal campaigns from Neon + Redis. 4-stage pipeline: DB query → targeting filter → budget pre-screen → creative rotation. Excludes Carbon-source creatives to prevent double-serving.

The `ad-delivery.service.ts` waterfall orchestrator calls providers in order (Carbon → Manual), checks shared gates (surface, quiet hours, frequency caps) once at the top, and merges results up to the requested count.

## Carbon Ads Integration

### System Campaign

A deterministic system advertiser and campaign are bootstrapped at process startup using SHA-256-derived UUIDs (`devdrip:carbon-ads-advertiser`, `devdrip:carbon-ads-campaign`). This avoids DB lookups for the campaign ID and is idempotent across restarts and multi-instance deploys.

The system campaign has near-infinite budget (`999,999`) and `asap` pacing so Carbon ads are never rejected by internal budget checks. The CPM rate is synced from the `CARBON_CPM_RATE` env var on each restart.

### Ephemeral Creatives

Each Carbon ad response is upserted as a creative row with `source: "carbon"`. The upsert key is `(source, externalCreativeId)` where the external ID is a SHA-256 hash of `company:description:statlink`. On conflict, metadata fields (headline, body, URLs, CPM rate) are refreshed but `surface` is preserved from the original insert.

### Beacon Firing

On completed impressions for Carbon-source creatives, the server fires a viewability beacon (HTTP GET to `statviewUrl`) as fire-and-forget. Non-OK HTTP responses are logged as warnings. Network failures are caught and logged.

### Stale Creative Cleanup

`carbon-cleanup.service.ts` deactivates Carbon creatives whose `updatedAt` is older than 24 hours. This runs on a 12-hour `setInterval` registered at startup. Deactivation (not deletion) preserves FK integrity with historical impressions.

### Environment Variables

| Variable           | Default         | Purpose                                                                       |
| ------------------ | --------------- | ----------------------------------------------------------------------------- |
| `CARBON_ZONE_KEY`  | `""` (disabled) | Carbon publisher zone ID. Empty string disables Carbon provider.              |
| `CARBON_PLACEMENT` | `devdrip`       | Placement slug sent to Carbon SDK                                             |
| `CARBON_CPM_RATE`  | `0.80`          | CPM rate in USDC for Carbon impressions. Validated as positive finite number. |

## Frequency Cap Engine

Frequency caps are tracked in Redis (`lib/frequency.ts`) with TTL-based keys:

| Key pattern                                             | TTL | Purpose                            |
| ------------------------------------------------------- | --- | ---------------------------------- |
| `freq:dev:{deviceId}:surface:{surface}:h:{date}:{hour}` | 2h  | per-surface hourly (cap: 4)        |
| `freq:dev:{deviceId}:total:h:{date}:{hour}`             | 2h  | total hourly (cap: 8 or user pref) |
| `freq:dev:{deviceId}:total:d:{date}`                    | 25h | total daily (cap: 60 or user pref) |
| `freq:dev:{deviceId}:campaign:{campaignId}:d:{date}`    | 25h | per-device-per-campaign daily      |

Caps are checked before ad selection (read-only) and incremented after impression recording. Redis errors fail open (same pattern as budget tracking).

Quiet hours use the user's `tzOffsetMinutes` preference (stored in the `preferences` table) to convert UTC to local time before comparing against `quietHoursStart`/`quietHoursEnd`. Defaults to UTC (offset 0) if not set.

## Budget Pacing Engine

Budget tracking lives in `src/lib/budget.ts` and uses Redis with TTL-based keys for automatic daily/hourly reset (no cron needed).

Redis key design (all UTC):

| Key pattern                                    | Type  | TTL  | Purpose                    |
| ---------------------------------------------- | ----- | ---- | -------------------------- |
| `budget:daily:{campaignId}:{YYYY-MM-DD}`       | float | 25h  | daily spend accumulator    |
| `budget:hourly:{campaignId}:{YYYY-MM-DD}:{HH}` | float | 2h   | hourly spend accumulator   |
| `budget:rotation:{campaignId}`                 | int   | none | creative round-robin index |

Pacing strategies:

- `even`: hourly cap = `budgetDaily / 24`, spread uniformly
- `front_loaded`: weighted curve (hours 0-7 get 1.5x, 8-15 get 1.0x, 16-23 get 0.5x)
- `asap`: no hourly cap, daily cap only

The `recordSpend` function uses an optimistic Redis pipeline (INCRBYFLOAT + EXPIRE) with compensating rollback if a cap is exceeded. It returns a `SpendResult` discriminated union so the impression pipeline can auto-pause exhausted campaigns.

Creative rotation uses round-robin via a Redis counter. The ad-serving layer calls `nextCreativeIndex(campaignId)` and applies modulo against active creative count.

## Rate Limit Tiers

- `global`: 100 requests / 60s by IP
- `public`: 20 requests / 60s by IP
- `auth`: 10 requests / 60s by IP
- `refresh`: 20 requests / 60s by IP
- `user`: 60 requests / 60s by user ID
- `sensitive`: 3 requests / 1h by user ID
- `admin`: 30 requests / 60s by IP
- `advertiser`: 30 requests / 60s by user ID

Headers set on limited routes:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` on `429`

## World Chain Endpoints (S4-WC1)

Added across PR1–PR4 of the World Chain Payments epic. Group by surface:

### Mini App auth (S4-WC1 PR2)

All gated by the `dd_miniapp` HttpOnly cookie (`Path=/miniapp`, audience `devdrip-miniapp`) except `/wallet-auth/*` and `/github-oauth/callback` (which establish the session).

- `POST /miniapp/wallet-auth/nonce` → `{ nonce }` (32-byte hex, 5-min TTL in Upstash).
- `POST /miniapp/wallet-auth/verify` — body `{ payload: MiniAppWalletAuthPayload, nonce }`. Calls `verifySiweMessage()` from `@worldcoin/minikit-js`. Single-use nonce. Upserts user by recovered address. Sets `dd_miniapp` cookie; signup-state claim is `true` if user already has `signedUpAt` set, else `false`. Returns `{ user_id, world_wallet_address }`.
- `POST /miniapp/world-id/verify` — body `{ proof }`. Forwards to `https://developer.world.org/api/v4/verify/${WORLD_APP_ID}` with `action=devdrip-signup`. On success, hex→BigInt nullifier, inserts into `nullifiers` (composite PK `(nullifier, action)`), binds `users.nullifier_hash` + `users.verification_level`. On `(nullifier, action)` collision returns `409 nullifier_already_used`.
- `GET /miniapp/github-oauth/start` (gated) — mints state, stores in Upstash with user_id, redirects to GitHub authorize URL.
- `GET /miniapp/github-oauth/callback?code&state` (no gate; uses state lookup) — exchanges code, fetches GitHub user, binds `users.github_id` + `github_login` + `email`, redirects to `${MINIAPP_BASE_URL}/m/signup?step=done`.
- `POST /miniapp/signup/complete` (gated) — asserts all 3 credentials bound, sets `signed_up_at = now()`, re-mints cookie with `signup: true`. Returns `{ user_id, already_complete }`.
- `GET /miniapp/me` (gated; S4-WC1 PR4) — Mini App equivalent of `/me`. Returns full user fields including World identity for the cookie's user_id.

### CLI pairing (S4-WC1 PR2)

- `POST /cli/pair` (anonymous) — mints Crockford-base32 code (`XXX-XXX-XXX`, no I/L/O/U) with 5-min TTL. Returns `{ code, link_url, qr_payload, expires_at }`.
- `GET /cli/pair/:code` (anonymous, long-poll) — server polls every 1s up to 25s. Returns `200 { token, refresh_token, user }` once linked, `202 { status: "pending" }` while pending, `410 { error: "pair_session_expired" }` once expired.
- `POST /miniapp/cli-link/:code` (gated by `requireCompletedMiniAppSession`) — atomic `UPDATE cli_pair_sessions SET status='linked'` with conditional `WHERE status='pending' AND expires_at > now`. Mints CLI tokens (byte-equivalent to `/auth/exchange` shape; same JWT issuer + audience + refresh_tokens row insert). Stashes `{ token, refresh_token, user }` in Redis under `cli:pair:tokens:<code>` with 5-min TTL for the long-poll to consume via `getdel`. Returns `{ ok: true, user }`.

### Balance + claim (S4-WC1 PR2)

All Bearer-auth (`requireAuth`).

- `GET /me/balance` → `{ availableUsdc, lifetimeEarnedUsdc, pendingPayoutsUsdc }`. Single SQL CTE: confirmed earnings minus paid+pending payouts, clamped to non-negative.
- `POST /me/payouts/claim` — header `Idempotency-Key: <uuid>` REQUIRED. Wrapped in `db.transaction(async tx => ...)` with `pg_advisory_xact_lock(hashtext('claim:' || user_id))` for per-user serialization. Replays with same key return existing row (with cross-user safety check → 409 if key collides across users). Validates balance ≥ `MIN_PAYOUT_USDC` (= $0.50). Inserts pending payout. Returns `{ id, status, amount_usdc, wallet_address }`.
- `GET /me/payouts/:id` → full payout row scoped to user. 404 if not owned.
- `GET /me/payouts?cursor=&limit=` — cursor pagination. Cursor format `<createdAt-iso>|<uuid>` for stable tuple ordering (the auto-disburse cron's batch INSERT can produce same-microsecond timestamps; the `id` tiebreaker prevents page-boundary skips/duplicates).

### Hot wallet ops (S4-WC1 PR3)

- `GET /admin/hot-wallet/balance` (gated by `requireAdmin` — timing-safe `x-admin-secret` header) — reads ETH + USDC balance via viem on World Chain Sepolia. Returns `{ address, chainId, ethWei, ethFormatted, usdcRaw, usdcFormatted }`.

### `/me` extension (S4-WC1 PR4)

The existing `GET /me` was extended to include World identity fields:

- `walletAddress: string | null`
- `verificationLevel: "device" | "orb" | null`
- `signedUpAt: string | null` (ISO timestamp)

Existing fields (`id`, `githubLogin`, `email`, `avatarUrl`) unchanged.

### Test-only helpers (non-prod only)

- `POST /__test/setup-paired-link` — mounted only when `nodeEnv !== "production"` (defense-in-depth: also short-circuits in handler if production). Body `{ code, userId, githubLogin }`. Inserts a synthetic user + atomically links the named pair_session. Used by PR2's daemon-compat integration test (`paired-token-prefs-sync.test.ts`) to bypass the full Mini App auth flow which needs real World ID + SIWE infra.

## Settlement Worker (S4-WC1 PR3)

The settlement worker is a **separate Railway service** spawned from `packages/api/src/worker.ts`. Same DB connection as the API; no HTTP listener.

### Loop semantics

Every 30s:

1. `BEGIN; SELECT … FOR UPDATE SKIP LOCKED LIMIT 1` over `payouts` rows in `pending` status OR `processing` status with `updated_at < now() - interval '5 minutes'` (crash-recovery fallback so a worker dying mid-broadcast doesn't strand the row).
2. Mark `status='processing'` inside the same tx, commit (releases the lock).
3. Hand off to `broadcastPayout()` (no DB lock held during the on-chain wait).

### Broadcast paths

`broadcastPayout(row)` has two modes:

- **Path A — fresh broadcast** (`row.tx_hash IS NULL`): pre-flight USDC balance check first (gas estimation simulates the transfer and would revert with "ERC20: transfer amount exceeds balance" if USDC is short — checking balance first surfaces `insufficient_funds` immediately). Then estimate gas, check ETH balance vs gas cost (else `insufficient_gas`). Sign + broadcast `transfer(to, amount)` via viem `walletClient.writeContract`. Stash `tx_hash` IMMEDIATELY so the next worker tick sees this attempt and switches to reconciliation. Wait up to 30s for receipt.
- **Path B — reconciliation only** (`row.tx_hash IS NOT NULL`): a previous attempt already broadcast a tx. Poll for the receipt; **NEVER** sign a second tx. This is the safe-money invariant — once a tx hash exists for a payout we either confirm it, see it revert on-chain, or fail permanently after retries — but we never duplicate the send.

### Retry semantics

`MAX_RETRIES = 3`. Receipt timeout (30s) → `retry_count++`, status back to `pending`. After 3 retries → `status='failed'` with `failure_reason='broadcast_timeout_after_3_retries'`. Gas multiplier on retry: `1 + 0.2 × retry_count` (handles network congestion + replacement-by-fee).

If a tx is genuinely dropped from the mempool, the row exhausts retries and lands in `failed`. **Operator recovery**: NULL out `tx_hash` + reset `status='pending'` to allow a fresh broadcast.

### Auto-disburse cron

`node-cron` schedule `0 0 * * 0` UTC. Single SQL `INSERT … SELECT` from a balance CTE for users with `confirmed earnings - (paid+pending) ≥ 5`. `ON CONFLICT (user_id, scheduled_for_week) DO NOTHING` — re-running the cron within the same week is a no-op.

Manual trigger for testing: `pnpm --filter @devdrip/api worker:once-disburse` calls `runAutoDisburse()` directly (not the wrapper that swallows errors), exit code propagates.

## Test Coverage Today

Current API tests cover:

- `/health` status shape
- absence of global rate-limit headers on `/health`
- key Helmet headers
- CORS allow and block behavior
- auth guard behavior for `/me`
- basic error cases for `/auth/exchange`
- basic error case for `/auth/refresh`
- auth guard behavior for `GET /ads/next`, `GET /ads/batch`, `POST /ads/next`, `/ingest`

Unit test suites:

- `ad-selection.test.ts` — 17 tests covering ManualAdProvider selection pipeline (targeting filters, budget pre-screen, rotation, count limits, beacon URL propagation)
- `impression.test.ts` — 8 tests covering impression recording (earnings calculation, spend tracking, frequency increment, campaign auto-completion, click recording)
- `carbon-ad-provider.test.ts` — 11 tests covering CarbonAdProvider (empty zone key, null response, SDK timeout, SDK error, DB upsert error, response translation with beacon URLs, truncation, placement config, count cap, tagline fallback)
- `waterfall.test.ts` — 12 tests covering waterfall orchestration (Carbon-first order, manual fallback, partial fill, empty from both, frequency caps, quiet hours, surface gate, delivery tokens, beacon URL propagation)
- `beacon.test.ts` — 3 tests covering beacon firing (success, network error, non-OK response logging)
- `ingest.test.ts` — covers `/ingest` batch happy path, grace-accept, replay rejection, click-by-jti, and machine rate-limit
- `reports-pacing.test.ts` — table-driven pacing formula: missing-startsAt, missing-endsAt, threshold edges
