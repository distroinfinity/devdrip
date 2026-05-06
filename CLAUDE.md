# CLAUDE.md

## Project Overview

Distro TV is an ambient news + market terminal feed that surfaces while AI coding tools think. Developers see tech/finance news from HN, TechCrunch, Bloomberg, and Reuters, plus a watchlist of stocks and crypto with sparklines. Originally launched as DevDrip (opt-in ads + USDC micropayments); pivoted to Distro TV in May 2026.

## Architecture

- **CLI + Daemon** — `@distrotv/cli` npm package (binary: `distro`). Hooks into Claude Code via settings.json (PreToolUse, Stop, UserPromptSubmit). Daemon on Unix socket manages slot display, key capture, local ledger (SQLite).
- **Backend API** — Express + Drizzle ORM + Neon PostgreSQL + Upstash Redis. Auth, device registration, channels, watchlists, alerts, slot impression ingestion.
- **Dashboard** — Next.js 14, App Router, Tailwind. Reading list, watchlist management, preferences.
- **Payments** — deferred post-M1. Base Sepolia testnet targeted for M6+.

## Tech Stack

- **everything TypeScript** — monorepo via Turborepo + pnpm workspaces
- packages: `cli`, `api`, `dashboard`, `shared`
- Express, Drizzle, Neon, Upstash, better-sqlite3, commander, tsup
- deploy: Railway GitHub autodeploy (API), Vercel via GitHub Actions (frontend), npm (CLI)

## Milestones

- M1 (current): rename + rip — packages renamed to `@distrotv/*`, ads ripped, slot types added
- M2: auth + device registration
- M3: news slot rendering
- M4: ticker slot + watchlist
- M5: demo loop end-to-end → merge to main

## Hard Rules

- &lt;200ms slot vanish — hard requirement, measure it, log it
- hooks always exit 0 — never block Claude Code
- local ledger is ground truth — backend can be down
- 3s grace period before showing slots — no slots on fast tool calls

## Dev Rules

- load frontend-design skill for anything frontend
- minimal comments, crisp pointers, lowercase start
- never mention claude or ai in commits, keep messages crisp
- after each notion task: post completion comment: key decisions, gotchas, tick AC checkboxes
- post every significant changes lets keep updating and maintaining engineering gitbook-docs
