# Data Model

`packages/api/src/db/schema` contains the domain model for the backend.

## Domains

## Auth and Identity

### `users`

Stores:

- email
- avatar
- referral code

Runtime usage today:

- magic-link auth upsert
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

- quiet hours
- idle sensitivity
- night mode
- channel mode
- news topics
- timezone offset
- `updatedAt` for last-write-wins sync

Runtime usage today:

- read/written via `GET /me/preferences` and `PUT /me/preferences`
- synced between CLI and dashboard via `updatedAt` last-write-wins

## invite_codes

Stores:

- invite code
- used by
- used at

Runtime usage today:

- written by `POST /invites` (admin-only batch generation)
- read by `GET /invites` (admin-only unused list)

## Enum Model

The schema and shared package define the main product vocab:

- `ImpressionResult` — completed, skipped, expired, interrupted
- `ChannelMode` — news_only, news_heavy, balanced, ticker_heavy, ticker_only
- `NewsTopic` — future-proofed topic filter enum
- IDE type — terminal, vscode, cursor

## Runtime Coverage Today

Tables directly touched by implemented API flows:

- `users`
- `refresh_tokens`
- `devices`
- `preferences`
- `invite_codes` (write via `POST /invites`, read via `GET /invites`)
- `channels` (read/written by channel subscription endpoints)
- `watchlists` (read/written by watchlist endpoints)
- `alerts` (read/written by alert endpoints)
- `news_impressions` (write via `POST /ingest`)
- `reading_list_items` (write via `POST /me/reading`, read via `GET /me/reading`)

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

## preferences (schema notes)

- `channel_mode text NOT NULL DEFAULT 'balanced'` — `news_only | news_heavy | balanced | ticker_heavy | ticker_only`. Migrated from legacy `earn | learn | mix` in M5.
- `news_topics text[] NOT NULL DEFAULT '{}'` — future-proofed for v1.1 topic filters.
- Columns `blocked_categories`, `enabled_surfaces`, `max_per_hour`, `max_per_day`, `session_warmup_ms` are defanged with safe defaults (`9999`, `99999`, `0`, `[]`, `[]`). A schema migration to drop them is deferred.

## Important Notes

- refresh token cleanup is still a TODO
