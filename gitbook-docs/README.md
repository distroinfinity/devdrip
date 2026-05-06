# Distro TV Engineering Docs

Current-state docs for engineers working in this repo.

> _Distro TV is the post-pivot product (2026-05). M1 (rip + rename) and M2 (magic-link auth + /setup onboarding) have shipped. Subsequent sections describing slot delivery, channels, watchlists, and admin tooling will be revised as M3-M8 land. See `docs/superpowers/specs/2026-05-05-distro-tv-pivot-design.md` (local) for the full design._

> **Previously DevDrip.** The product was originally called DevDrip (opt-in ads + USDC micropayments). In May 2026 it pivoted to Distro TV — an ambient news + market terminal feed. Pages flagged "(deprecated)" describe surfaces being torn out. The agent-treasury pivot page describes a prior intermediate direction that was also superseded.

## What Distro TV Is

Distro TV anchors an ambient content slot at the bottom of the terminal during AI coding tool idle time. Tech and finance news from HN, TechCrunch, Bloomberg, and Reuters. A watchlist of stocks and crypto with sparklines and key stats. Three modes: news-only, markets-only, or alternating mix with alert-driven priority bumps.

In the repo today, the implemented product surface is split across these packages:

- `frontend` runs the public landing page and the waitlist intake flow.
- `packages/api` runs the backend API for health, auth, device registration, and slot impression ingestion.
- `packages/shared` holds shared enums, slot payload types, and constants.
- `packages/cli` exposes the CLI command surface (`distro init`, `distro daemon`, `distro status`, `distro watchlist`, etc.).
- `packages/dashboard` is a separate dashboard app shell with minimal UI today.

## Current State (post-M2)

```text
browser
  -> frontend landing page + waitlist
  -> /setup onboarding (pair-exchange, magic-link sign-in)
  -> /sign-in (magic-link form)
  -> /dashboard/* (auth-gated; account page, preferences, reading)
     -> session JWT in HTTP-only cookie

cli / daemon
  -> packages/api
     -> anonymous device registration (no auth required)
     -> magic-link auth (Resend, SHA-256 hashed tokens)
     -> pairing handoff (CLI → browser → /setup)
     -> jwt auth (7-day session JWT)
     -> postgres via drizzle
     -> redis via upstash (pairing codes, rate-limit)
```

What is real right now (end of M2):

- landing page and waitlist flow
- anonymous-first device registration (device bearer auth)
- magic-link sign-in via Resend + optional anonymous→email upgrade
- CLI ↔ browser pairing handoff (`distro init` → `/setup?pair=…`)
- `/setup` onboarding page with 4 states
- `/dashboard/account` (email, user/device IDs, sign-out)
- middleware auth gate (dashboard protected behind session cookie)
- slot impression ingestion (news kind)
- slot cache (reads `/me/content/next`, falls back to demo fixtures)
- daemon lifecycle (start/stop/status/heartbeat)
- hook IPC (PreToolUse, Stop, UserPromptSubmit → daemon socket)
- reading list ledger (local SQLite)
- `distro init`, `distro doctor`, `distro status`, `distro watchlist`, `distro demo`

What arrives in upcoming milestones:

- M3: news pipeline (channels schema + worker + selection algorithm)
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
