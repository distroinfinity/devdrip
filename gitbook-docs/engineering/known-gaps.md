# Known Gaps

These are the main current-state gaps that matter when working in this repo.

## CLI

- command surface exists, but most command bodies are `TODO`
- `admin` is the first fully implemented command group (advertiser / campaign / creative / stats / invite / user / payouts) — it wraps the corresponding admin API routes
- no daemon implementation
- no hook implementation
- no local ledger
- no local sync path
- no payout flow (developer-facing `claim` command is still `TODO`; admin-side visibility is now available via `devdrip admin payouts`)

## Dashboard

- separate app exists, but only a minimal page is implemented
- no auth, data fetching, or product screens yet

## Backend Coverage

- health, auth, device registration, and campaign management (advertisers/campaigns/creatives CRUD) are implemented with layered architecture (validators, services, error handling)
- campaign status transitions are atomic (transaction + SELECT FOR UPDATE)
- budget pacing engine is built (Redis-backed daily/hourly tracking, pacing strategies, creative rotation) and integrated with the impression ingestion pipeline
- ad serving pipeline is implemented: `GET /ads/next` (single ad, 204 when empty), `GET /ads/batch` (up to 10 ads), `POST /ads/next` (backward-compat) with Carbon Ads (primary) → Manual (fallback) waterfall. `POST /impressions` and `POST /clicks` (single-record routes) are replaced by `POST /ingest` (batch, delivery-token keyed, with grace-accept and per-item error taxonomy). Frequency caps, budget tracking, earnings calculation, delivery tokens, beacon URLs, and viewability beacons all carried forward.
- impression outcomes are derived from delivery-token age on the server, but there is still no daemon-side viewability attestation or anti-fraud layer beyond auth, rate limits, and one-time tokens
- admin surface uses X-Admin-Secret (shared secret, no caller identity or audit trail) — should converge on authenticated admin principals for production. Admin routes now include `/admin/stats`, `/admin/users`, `/admin/payouts`, `/invites` in addition to the existing advertiser/campaign/creative CRUD. Secret comparison is timing-safe (`crypto.timingSafeEqual`) but the whole scheme is still a single shared credential.
- admin-mutation audit log — no record of _who_ triggered `PATCH /admin/payouts/:id/status` or invite generation (shared secret has no caller identity). Acceptable at 100-user scale; revisit before widening operator access.
- admin route naming is inconsistent — advertisers/campaigns/invites mount at top-level while stats/users/payouts mount under `/admin/*`. Pick one convention (likely fold everything under `/admin/*`) before the admin surface grows further.
- CLI list commands have no `--offset` — fine at `--limit 100` default, but scripts needing deep pagination will have to hit the backend directly until added.
- `CARBON_CPM_RATE` is a static env var estimate ($0.80) — Carbon's SDK returns no pricing data per impression. Developer earnings are recorded as `cpmRate / 1000 * 0.70` using this guess. For production payouts, need to reconcile against Carbon's actual publisher payouts (via their reporting dashboard/API) and mark earnings as "estimated" until confirmed. Currently using Carbon demo zone (`CWYDC2QE`) with no real payout implications.
- Carbon click tracking URL (`statlink`) is stored but not fired server-side on click — needs investigation into whether Carbon expects server-side click beacons or relies on the client opening the tracking redirect URL
- Carbon response caching not implemented — every `/ads/next` hits Carbon's API. At scale, a short Redis/in-process cache (30-60s TTL) would reduce external calls
- EthicalAds provider integration not yet built (AdProvider interface is ready for it)
- earnings confirmation, payout creation (developer `claim`), preferences CRUD, referrals, and invite **redemption** flows are not yet exposed as API routes. Admin-side payout list + status override and invite generation are wired.
- `GET /me/preferences` does not exist yet — `PUT /me/preferences` accepts `blockedCategories` + `tzOffsetMinutes` only. `devdrip config` (S2-12) writes all other preference fields (`maxPerHour`, `maxPerDay`, `sessionWarmupMs`, `quietHoursStart/End`, `nightMode`) to `~/.devdrip/config.json` locally and expects the dashboard sync API (S4-06) to bidirectionally reconcile them later.
- rate-limit enforcement (`maxPerHour` / `maxPerDay`) inside the daemon orchestrator is not wired — values are persisted + reloaded, but the orchestrator does not query the local ledger yet. Quiet hours + session warmup ARE enforced.
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

## Impressions Loop (S3-06 → S3-10)

- **Earnings summary up to 60s stale.** Redis cache TTL on `GET /me/earnings/summary`. No UI disclosure at MVP; acceptable.
- **Tokens > 24h expired are rejected** (`delivery_token_too_old`). Rare — requires a device to be offline > 24h with queued impressions. Those impressions lose earnings but are not replayed.
- **Clicks whose parent impression never syncs within 24h are tombstoned** (`impression_not_synced` → terminal after 24h from `click.created_at`). Near-zero expected frequency in normal usage.
- **`listCampaignReports` runs a per-campaign subquery loop (N+1).** Acceptable at MVP scale (dozens of campaigns); revisit if the admin dashboard starts paging or shows slow queries.
- **`getCampaignReport` / `getAdvertiserReport` each re-run `listCampaignReports()` with no filter then filter in memory.** Double-scan inefficiency; refactor when admin traffic grows.
- **Analytics `category` filter narrows `series` and `totals` but NOT `bySource` / `byResult` breakdowns.** Internally inconsistent when a `category` filter is applied. Follow-up ticket needed if the dashboard requires fully-filtered breakdowns.
- **Sync `stop()` doesn't await in-flight `runOnce`** on daemon shutdown. Any mark-sync writes to a closing ledger silently fail; those rows retry on next boot (idempotent via `impression_already_recorded`). Fix: expose `awaitIdle()` when needed.
- **Drizzle-kit `db:migrate` fails silently in local dev** (observed during this branch). Workaround: apply migrations via `psql` directly. Investigate separately.
