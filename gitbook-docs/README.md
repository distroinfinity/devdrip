# DevDrip Engineering Docs

Current-state docs for engineers working in this repo.

> **Direction shift in flight.** DevDrip is pivoting to an agent-treasury model on Base Sepolia, powered by KeeperHub + Uniswap. World ID, World Chain, and the Mini App are being removed. Read [Agent Treasury Pivot](architecture/agent-treasury-pivot.md) before anything else — pages flagged "(deprecated)" describe surface that's being torn out on the `pivot/agent-treasury` branch.

## What DevDrip Is

DevDrip is building an opt-in monetization layer around AI coding tool idle time. Earnings are routed into **vault rules** — recurring or conditional Uniswap swaps executed durably by KeeperHub workflows, surfaced to the user via dashboard, CLI, and an MCP server agents can call directly.

In the repo today, the implemented product surface is split across these packages:

- `frontend` runs the public landing page and the waitlist intake flow.
- `packages/api` runs the backend API for health, auth, device registration, and campaign management (advertisers, campaigns, creatives CRUD with budget pacing).
- `packages/shared` holds shared enums, types, and constants for the product model.
- `packages/cli` exposes the planned CLI command surface, with most commands still stubbed.
- `packages/dashboard` is a separate dashboard app shell with minimal UI today.

## Current State

```text
browser
  -> frontend landing page
  -> frontend waitlist route
     -> neon postgres
     -> resend email

cli / dashboard
  -> packages/api
     -> github oauth
     -> jwt auth
     -> postgres via drizzle
     -> redis via upstash
```

What is real right now:

- landing page sections and waitlist form
- waitlist insert and confirmation email flow
- backend health checks
- GitHub OAuth callback flow
- one-time auth code exchange
- refresh token rotation
- authenticated device registration
- admin-protected CRUD for advertisers, campaigns, and creatives
- campaign status state machine (draft → active → paused ↔ active → completed) with activation guards
- Redis-backed budget pacing engine (daily/hourly tracking, even/front_loaded/asap strategies)
- creative round-robin rotation via Redis
- campaign stats aggregation (impressions, clicks, CTR, live spend)
- shared domain model for impressions, earnings, payouts, and referrals

What is not built yet:

- daemon flow
- local ledger flow
- ad serving waterfall
- impression ingestion API
- earnings and payout APIs
- real dashboard product pages
- operational CLI behavior beyond scaffolding

## Read This Next

- [Architecture Overview](architecture/overview.md)
- [Monorepo Layout](architecture/monorepo.md)
- [Backend API](backend/api.md)
- [Data Model](backend/data-model.md)
- [Landing And Waitlist](frontend/landing-and-waitlist.md)
- [CLI Current State](cli/current-state.md)
- [Dashboard Current State](dashboard/current-state.md)
- [Dev Workflow](engineering/dev-workflow.md)
- [Known Gaps](engineering/known-gaps.md)
- [Glossary](engineering/glossary.md)

## Ground Rules For These Docs

- document code that exists
- stay crisp and operational
- prefer current behavior over intent
- call out important gaps only when they affect engineering work
