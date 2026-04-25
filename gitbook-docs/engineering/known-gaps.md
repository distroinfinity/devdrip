# Known Gaps

These are the main current-state gaps that matter when working in this repo.

## CLI

- command surface exists, but most command bodies are `TODO`
- no daemon implementation
- no hook implementation
- no local ledger
- no local sync path
- no payout flow

## Dashboard

- separate app exists, but only a minimal page is implemented
- no auth, data fetching, or product screens yet

## Backend Coverage

- health, auth, device registration, and campaign management (advertisers/campaigns/creatives CRUD) are implemented with layered architecture (validators, services, error handling)
- campaign status transitions are atomic (transaction + SELECT FOR UPDATE)
- budget pacing engine is built (Redis-backed daily/hourly tracking, pacing strategies, creative rotation) and integrated with the impression ingestion pipeline
- ad serving pipeline is implemented: `GET /ads/next` (single ad, 204 when empty), `GET /ads/batch` (up to 10 ads), `POST /ads/next` (backward-compat) with Carbon Ads (primary) → Manual (fallback) waterfall, `POST /impressions`, `POST /clicks` with frequency caps, budget tracking, earnings calculation, delivery tokens, beacon URLs in response, and viewability beacons
- impression outcomes are derived from delivery-token age on the server, but there is still no daemon-side viewability attestation or anti-fraud layer beyond auth, rate limits, and one-time tokens
- admin surface uses X-Admin-Secret (shared secret, no caller identity or audit trail) — should converge on authenticated admin principals for production
- `CARBON_CPM_RATE` is a static env var estimate ($0.80) — Carbon's SDK returns no pricing data per impression. Developer earnings are recorded as `cpmRate / 1000 * 0.70` using this guess. For production payouts, need to reconcile against Carbon's actual publisher payouts (via their reporting dashboard/API) and mark earnings as "estimated" until confirmed. Currently using Carbon demo zone (`CWYDC2QE`) with no real payout implications.
- Carbon click tracking URL (`statlink`) is stored but not fired server-side on click — needs investigation into whether Carbon expects server-side click beacons or relies on the client opening the tracking redirect URL
- Carbon response caching not implemented — every `/ads/next` hits Carbon's API. At scale, a short Redis/in-process cache (30-60s TTL) would reduce external calls
- EthicalAds provider integration not yet built (AdProvider interface is ready for it)
- earnings confirmation, payouts, preferences CRUD, referrals, and invite flows are not yet exposed as API routes
- auth and devices routes still use the older inline pattern (not yet refactored to layered architecture)

## Waitlist Storage

- the waitlist route writes to a `waitlist` table
- that table is not modeled in the Drizzle schema under `packages/api`
- frontend waitlist persistence and backend schema are currently separate concerns

## Auth Implementation Notes

- refresh token rotation still has a documented transactional race TODO
- refresh token cleanup job is still a TODO

## Validation And Tooling

- root validation needs installed dependencies
- Turbo-backed commands cannot run in a clean checkout without `pnpm install`

## Repo Note

- `CLAUDE.md` is already modified in the working tree
- future work should avoid overwriting it unless the task is explicitly about that file
