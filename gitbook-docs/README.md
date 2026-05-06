# Distro TV Engineering Docs

Current-state docs for engineers working in this repo.

> _Distro TV is the post-pivot product (2026-05-05). Sections describing earnings/payouts/wallet/world will be revised as M1-M8 land. See `docs/superpowers/specs/2026-05-05-distro-tv-pivot-design.md` for the full design._

> **Previously DevDrip.** The product was originally called DevDrip (opt-in ads + USDC micropayments). In May 2026 it pivoted to Distro TV — an ambient news + market terminal feed. Pages flagged "(deprecated)" describe surfaces being torn out. The agent-treasury pivot page describes a prior intermediate direction that was also superseded.

## What Distro TV Is

Distro TV anchors an ambient content slot at the bottom of the terminal during AI coding tool idle time. Tech and finance news from HN, TechCrunch, Bloomberg, and Reuters. A watchlist of stocks and crypto with sparklines and key stats. Three modes: news-only, markets-only, or alternating mix with alert-driven priority bumps.

In the repo today, the implemented product surface is split across these packages:

- `frontend` runs the public landing page and the waitlist intake flow.
- `packages/api` runs the backend API for health, auth, device registration, and slot impression ingestion.
- `packages/shared` holds shared enums, slot payload types, and constants.
- `packages/cli` exposes the CLI command surface (`distro init`, `distro daemon`, `distro status`, `distro watchlist`, etc.).
- `packages/dashboard` is a separate dashboard app shell with minimal UI today.

## Current State (post-M1)

```text
browser
  -> frontend landing page
  -> frontend waitlist route
     -> neon postgres
     -> resend email

cli / daemon
  -> packages/api
     -> github oauth
     -> jwt auth
     -> postgres via drizzle
     -> redis via upstash
```

What is real right now (end of M1):

- landing page and waitlist flow
- GitHub OAuth + JWT auth
- device registration
- slot impression ingestion (news kind)
- slot cache (reads `/me/content/next`, falls back to demo fixtures)
- daemon lifecycle (start/stop/status/heartbeat)
- hook IPC (PreToolUse, Stop, UserPromptSubmit → daemon socket)
- reading list ledger (local SQLite)
- `distro init`, `distro doctor`, `distro status`, `distro watchlist`, `distro demo`

What arrives in upcoming milestones:

- M2: auth stabilization + real device-registration round-trip
- M3: live news slot rendering from API
- M4: ticker slots + watchlist management
- M5: demo loop end-to-end → merge to main

## Read This Next

- [Architecture Overview](architecture/overview.md)
- [Monorepo Layout](architecture/monorepo.md)
- [Backend API](backend/api.md)
- [Data Model](backend/data-model.md)
- [Landing And Waitlist](frontend/landing-and-waitlist.md)
- [CLI Current State](cli/current-state.md)
- [Daemon + Hook IPC](cli/daemon-and-hooks.md)
- [News and Reading (CLI)](cli/news-and-reading.md)
- [Dev Workflow](engineering/dev-workflow.md)
- [Known Gaps](engineering/known-gaps.md)
- [Glossary](engineering/glossary.md)

## Ground Rules For These Docs

- document code that exists
- stay crisp and operational
- prefer current behavior over intent
- call out important gaps only when they affect engineering work
