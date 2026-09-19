# Known Gaps

Current-state gaps that matter when working in this repo.

## CLI

- `distro doctor --fix` auto-remediation not implemented (deferred — duplicates `init` paths)
- backend `/me/uninstall` endpoint for retention tracking not yet built
- `distro preferences → mode` and quiet hours are interactive; `--set` scripting works for simple keys

## Backend Coverage

- `GET /me/preferences` is not fully symmetrical with `PUT /me/preferences` — some preference fields are CLI-local only
- rate-limit enforcement (`maxPerHour` / `maxPerDay`) inside the daemon is not wired to the local ledger
- admin-mutation audit log — no record of who triggered admin operations (shared secret, no caller identity). Acceptable at current scale.
- admin route naming is inconsistent — some mount at top-level, others under `/admin/*`. Consolidate under `/admin/*` before the admin surface grows.
- `CARBON_CPM_RATE` env var is a static estimate — legacy from the ad era; used only if any ad code paths remain. Can be dropped when ad tables are fully pruned.
- CLI list commands have no `--offset` — fine at `--limit 100` default; scripts needing deep pagination must hit the backend directly.

## Data Model

- `advertisers`, `campaigns`, `creatives`, `impressions` (ad), `clicks`, `earnings_ledger`, `payouts`, `referrals` tables are pre-pivot artifacts. They are still in the Drizzle schema and migrations but unused at runtime. Pruning them is a future clean-up ticket.
- `users.wallet_address`, `users.nullifier_hash`, `users.verification_level` columns are pre-pivot; nulled out for all current users.
- `reading_list_items.saved` / `news_impressions.saved` deduplicate across two tables by design; no planned change.

## Waitlist Storage

- the legacy waitlist table exists in Neon but is no longer written to post-M1; no route or migration to clean it up yet.

## Auth Implementation Notes

- refresh token rotation has a documented transactional race TODO
- refresh token cleanup job (prune expired rows) is still a TODO

## Validation And Tooling

- root validation needs installed dependencies
- Turbo-backed commands cannot run in a clean checkout without `pnpm install`
- Drizzle-kit `db:migrate` has been observed to fail silently in local dev — workaround: apply migrations via `psql` directly.

## Impressions Loop

- **Earnings summary** (`GET /me/earnings/summary`) is pre-pivot infrastructure — it still exists and is called by some dashboard paths but the earnings amounts will all be zero for Distro TV users.
- **Tokens > 24h expired are rejected** (`delivery_token_too_old`). Rare; requires a device to be offline > 24h with queued impressions.
- **`listCampaignReports` N+1 subquery loop** — acceptable at MVP scale; revisit if admin report pages slow down.

## M8 — Landing page + install vector (2026-05-19)

- Real landing page at `/` with channels-first positioning (CH 01 NEWS, CH 02 MARKETS, CH 0? COMING).
- Install vector: `curl -fsSL https://distrotv.xyz/install.sh | sh` backed by GitHub Releases. No npm publish.
- `release-cli.yml` workflow on `cli-v*` tag push.
- OG and Twitter cards refreshed to match the new positioning.
- Dropped pre-pivot `publish-cli.yml` and the stale "dev drip" wordmark.
