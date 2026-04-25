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

- schema covers much more than the current route surface
- health, auth, and device registration are implemented
- campaign management, ad serving, impression ingestion, earnings, payouts, preferences, referrals, and invite flows are not yet exposed as API routes

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
