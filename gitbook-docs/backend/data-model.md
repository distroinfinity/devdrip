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
- tracking URLs
- active flag

Runtime usage today:

- schema only
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

### `clicks`

Stores one click per impression.

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

- schema only
- invite codes are present in DB seed data

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

Tables modeled and seeded but not yet exposed through implemented API routes:

- `preferences`
- `advertisers`
- `campaigns`
- `creatives`
- `impressions`
- `clicks`
- `earnings_ledger`
- `payouts`
- `referrals`
- `invite_codes`

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
