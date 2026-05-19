# Distro TV Engineering Docs

Current-state docs for engineers working in this repo.

> **Previously DevDrip.** The product was originally called DevDrip (opt-in ads + USDC micropayments). In May 2026 it pivoted to Distro TV — an ambient channel surface that surfaces during AI coding tool idle time. Pages marked "Status: superseded" document surfaces that were torn out (World Chain integration, agent-treasury pivot, Mini App).

## What Distro TV Is

Distro TV anchors an ambient content slot at the bottom of the terminal during AI coding tool idle time. Two launch channels:

- **CH 01 NEWS** — tech and finance headlines from HN, TechCrunch, Bloomberg, Reuters
- **CH 02 MARKETS** — watchlist of stocks and crypto with sparklines and key stats

Additional channels slot into the same surface without changing the CLI or daemon. Users control the news/ticker ratio (five positions from news-only to ticker-only), set quiet hours, and manage their watchlist.

## Architecture

```text
distrotv.xyz (frontend)
  → landing page + install CTA
  → /setup onboarding (pair-exchange, magic-link sign-in)
  → /sign-in (magic-link form)
  → /dashboard/* (auth-gated; channel config, watchlist, reading, alerts)
     → session JWT in HTTP-only cookie (distrotv_session)

cli / daemon
  → packages/api
     → anonymous device registration
     → magic-link auth (Resend, SHA-256 hashed tokens)
     → pairing handoff (CLI → browser → /setup)
     → slot selection (/me/content/next)
     → impression ingest (/ingest)
     → postgres via drizzle (Neon)
     → redis via upstash (pairing codes, slot caches, alert queues)
```

## Milestones (all shipped)

- M1: rename + rip — packages renamed to `@distrotv/*`, ads ripped, slot types added
- M2: magic-link auth + device registration + `/setup` onboarding
- M3: news pipeline (channels schema + fetcher worker + selection algorithm)
- M4: ticker slots + watchlist management
- M5: demo loop end-to-end → merge to main
- M6: dashboard polish (v5 visual language, 5-position channel mode)
- M7: admin dashboard (sources/tickers/users/metrics CRUD + Slack alerts)
- M8: landing page + install vector (curl + GitHub Releases, channels-first positioning)

## Install

```sh
curl -fsSL https://distrotv.xyz/install.sh | sh
```

## Read This Next

- [Architecture Overview](architecture/overview.md)
- [Monorepo Layout](architecture/monorepo.md)
- [Identity & Auth](architecture/identity.md)
- [Backend API](backend/api.md)
- [Data Model](backend/data-model.md)
- [Landing Page](frontend/landing-page.md)
- [CLI Current State](cli/current-state.md)
- [CLI Releases](cli/releases.md)
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
