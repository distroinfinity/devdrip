# Data Model

`packages/api/src/db/schema` contains the current domain model for the backend.

## Domains

## Auth and Identity

### `users`

Stores:

- GitHub identity
- email
- avatar
- repo count
- primary language
- wallet address
- referral code
- consent and streak fields

Runtime usage today:

- GitHub OAuth upsert
- `/me` identity response
- refresh token rotation lookup

### `refresh_tokens`

Stores:

- hashed refresh token
- token family
- expiry
- revoke timestamp

Runtime usage today:

- auth callback token issuance
- refresh token rotation
- logout family revocation

## Devices and Preferences

### `devices`

Stores:

- user relation
- stable machine hash
- device name
- OS
- IDE type
- last heartbeat

Runtime usage today:

- `/devices` registration and heartbeat refresh

### `preferences`

Stores:

- blocked categories
- enabled surfaces
- per-hour and per-day caps
- quiet hours
- idle sensitivity

Runtime usage today:

- schema only

## Ads and Campaigns

### `advertisers`

Stores advertiser identity and billing info.

Runtime usage today:

- full CRUD via admin API (`/advertisers`)
- delete guarded by active campaign check
- present in DB seed data

### `campaigns`

Stores:

- advertiser relation
- total and daily budgets
- spend
- CPM rate
- target categories
- target surfaces
- targeting rules
- pacing strategy
- status
- schedule

Runtime usage today:

- full CRUD via admin API (`/campaigns`)
- status machine with transition guards (draft → active → paused ↔ active → completed)
- stats aggregation endpoint joining impressions and clicks
- budget pacing tracked in Redis (`budget:daily:*`, `budget:hourly:*`)
- present in DB seed data

### `creatives`

Stores:

- campaign relation
- headline and body
- CTA text and URL
- format
- surface
- category
- source
- CPM rate
- external provider IDs
- tracking URLs (click, viewability beacon, impression beacon)
- active flag

Runtime usage today:

- full CRUD via admin API (`/campaigns/:id/creatives`)
- delete guarded by impressions FK (RESTRICT) — returns deactivation hint
- round-robin rotation tracked in Redis (`budget:rotation:*`)
- Carbon ads upsert ephemeral rows with `source: "carbon"` and dedup on `(source, externalCreativeId)` via partial unique index
- stale Carbon creatives deactivated by cleanup service (24h threshold)
- present in DB seed data

## Impressions and Earnings

### `impressions`

Stores:

- creative relation
- device relation
- source
- surface
- duration
- result
- CPM rate
- earned amount
- `delivery_jti varchar(36)` (nullable) — the `jti` claim from the delivery token. Unique index `impressions_delivery_jti_idx` enforces DB-level anti-replay for batch ingest. The Redis nonce is an early-reject optimization; this index is authoritative. Old rows (pre-S3-06) remain `NULL`.

Additional indexes added for analytics and click→impression lookup:

- `impressions_delivery_jti_idx` — unique index on `delivery_jti` (sparse; NULLs not indexed).
- `impressions_source_created_idx` — composite index on `(source, created_at)` used by the analytics `bySource` breakdown and date-range scans.

### `clicks`

Stores one click per impression.

Index `clicks_created_idx` on `clicks(created_at)` used by analytics date-range queries.

### `earnings_ledger`

Stores:

- user relation
- impression relation
- amount in USDC
- surface
- ad category
- earning status

Runtime usage today:

- schema only
- present in DB seed data

## Payouts and Referrals

### `payouts`

Stores:

- user relation
- amount in USDC
- wallet address
- tx hash
- payout status
- failure reason
- confirmed timestamp

### `referrals`

Stores:

- referrer
- referee
- referral code
- referral status
- bonus paid flag

### `invite_codes`

Stores:

- invite code
- used by
- used at

Runtime usage today:

- written by `POST /invites` (admin-only batch generation, called by `devdrip admin invite generate`)
- read by `GET /invites` (admin-only unused list)
- redemption flow (marking `usedBy` + `usedAt` on signup) is still pending — see S5-08

## Enum Model

The schema and shared package define the main product vocab:

- ad source
- ad format
- ad surface
- ad category
- campaign status
- earning status
- payout status
- impression result
- IDE type

These enums already model the intended ad and payout system even though the current API surface is still smaller.

## Runtime Coverage Today

Tables directly touched by implemented API flows:

- `users`
- `refresh_tokens`
- `devices`
- `advertisers`
- `campaigns`
- `creatives`
- `impressions` (write via `POST /ingest`, read via campaign stats aggregation and analytics)
- `clicks` (write via `POST /ingest`, read via campaign stats aggregation and analytics)
- `earnings_ledger` (write via `POST /ingest` for completed impressions, read via `GET /admin/stats`, `GET /admin/users`, `GET /me/earnings/summary`)
- `invite_codes` (write via `POST /invites`, read via `GET /invites`)
- `payouts` (read via `GET /admin/payouts`, status override via `PATCH /admin/payouts/:id/status` — create path still pending via the claim flow)

Tables modeled and seeded but not yet exposed through dedicated API routes:

- `preferences` (read by ad serving for user gates)
- `referrals`

## Seed Data

`src/db/seed.ts` seeds:

- 1 advertiser
- 1 active campaign
- 3 creatives across surfaces
- 2 users
- 2 devices
- 2 preference rows
- 5 impressions
- earnings for completed impressions
- 3 invite codes

This is useful for local development once the DB is configured.

## Important Notes

- the waitlist table used by `frontend/app/api/waitlist/route.ts` is not part of this Drizzle schema tree
- refresh token cleanup is still a TODO
