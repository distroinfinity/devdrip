# Data Model

`packages/api/src/db/schema` contains the domain model for the backend.

> **Note on pre-pivot tables.** The schema still contains tables from the DevDrip era: `advertisers`, `campaigns`, `creatives`, `impressions` (ad), `clicks`, `earnings_ledger`, `payouts`, `referrals`. These are not written to at runtime for Distro TV users. Pruning them is a future clean-up ticket.

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

- GitHub OAuth upsert — `repos_count` (`public_repos`) and `primary_language` (top language across public repos) are populated here, best-effort; existing users backfill on next sign-in
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
- CLI version (`cli_version`, migration `0022`)
- last heartbeat

Runtime usage today:

- `/devices` updates the authenticated device **by id** (os / ide_type / device_name / cli_version / last_heartbeat). The pairing-time row carries a placeholder `machine_id_hash`, so the legacy `(user_id, machine_id_hash)` upsert never matched it; the by-id path is what actually lands metadata. Reported by the daemon on startup (CLI ≥ 0.2.4).

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

- written by `POST /invites` (admin-only batch generation)
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

## news_impressions

Analytics ledger for news views. Fully isolated from earnings — no `earned_amount` column by design.

| Column      | Type        | Notes                                            |
| ----------- | ----------- | ------------------------------------------------ |
| id          | uuid        | primary key                                      |
| user_id     | uuid        | FK → users (cascade)                             |
| device_id   | uuid        | FK → devices (cascade)                           |
| news_id     | text        | namespaced: "hn:38291043"                        |
| source      | text        | "hn" — enum at app layer                         |
| duration_ms | integer     |                                                  |
| result      | text        | ImpressionResult                                 |
| opened_url  | boolean     | user pressed `d` while showing                   |
| saved       | boolean     | denormalized — also exists in reading_list_items |
| created_at  | timestamptz |                                                  |

Indexes: `(user_id)`, `(user_id, created_at)` for the stories-read query hot path.

## reading_list_items

Saved stories. Snapshot fields survive upstream edits.

| Column   | Type        | Notes                 |
| -------- | ----------- | --------------------- |
| id       | uuid        |                       |
| user_id  | uuid        | FK → users (cascade)  |
| news_id  | text        |                       |
| source   | text        |                       |
| headline | text        | snapshot at save time |
| url      | text        | snapshot              |
| score    | integer     | snapshot              |
| saved_at | timestamptz |                       |

Indexes: `(user_id, saved_at)`, unique `(user_id, news_id)` (idempotent saves).

## preferences (extended)

Two added columns:

- `channel_mode text NOT NULL DEFAULT 'balanced'` — `news_only | news_heavy | balanced | ticker_heavy | ticker_only | onchain_only`. Migrated from the legacy `earn / learn / mix` enum in M5. `onchain_only` added by migration `0024_*` (extends the `preferences_channel_mode_check` constraint) for CH 03.
- `news_topics text[] NOT NULL DEFAULT '{}'` — future-proofed for v1.1 topic filters

## Onchain (CH 03 — LP GUARD)

Three tables for the onchain channel (migration `0023_*`). Independent of the ticker/news tables. See [Onchain LP Guard](../architecture/onchain-lp-guard.md).

### `onchain_pools`

Pool registry the public snapshot route reads.

- `pool_id` PK
- `chain_id`
- `hook_address`
- `label`
- `token0`, `token1`
- `decimals`
- `tick_spacing`

### `onchain_positions`

A user's tracked LP range.

- `id` PK
- `user_id` FK → users
- `chain_id`
- `pool_id`
- `position_token_id` (nullable)
- `tick_lower`, `tick_upper`
- `wallet_address`
- `label`
- `status` — `active` rows are the ones actions/eval resolve

### `onchain_events`

Fire log for alert debounce — per `(device, type)`, 60-min window. Mirrors the ticker `alert_events` role for the reused alert pipeline.

## Important Notes

- the waitlist table used by `frontend/app/api/waitlist/route.ts` is not part of this Drizzle schema tree
- refresh token cleanup is still a TODO
