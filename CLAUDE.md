# CLAUDE.md

## Project Overview

Distro TV is an ambient **channel surface** that runs in the developer's terminal while AI coding tools work. Launch channels: **CH 01 NEWS** (HN, TechCrunch, Bloomberg, Reuters) and **CH 02 MARKETS** (stocks, crypto, FX, indices, watchlist + sparklines). Future channels (weather, build status, deploy logs, sports, calendar, crypto deep) slot into the same surface — the product is the surface, channels are the verticals. Originally launched as DevDrip (opt-in ads + USDC micropayments); pivoted to Distro TV in May 2026.

## Architecture

- **CLI + Daemon** — `@distrotv/cli` distributed via GitHub Releases + `curl ... | sh` install script (NOT npm). Binary: `distro`, alias `dtv`. Hooks into Claude Code via settings.json (PreToolUse, Stop, UserPromptSubmit). Daemon on Unix socket manages slot display, key capture, local ledger (SQLite).
- **Backend API** — Express + Drizzle ORM + Neon PostgreSQL + Upstash Redis. Auth, device registration, channels, watchlists, alerts, slot impression ingestion.
- **Dashboard** — Next.js 14, App Router, Tailwind. Reading list, watchlist management, preferences.
- **Payments** — deferred post-M1. Base Sepolia testnet targeted for M6+.

## Tech Stack

- **everything TypeScript** — monorepo via Turborepo + pnpm workspaces
- packages: `cli`, `api`, `dashboard`, `shared`
- Express, Drizzle, Neon, Upstash, better-sqlite3, commander, tsup
- deploy: Railway GitHub autodeploy (API), Vercel (frontend + landing at distrotv.xyz), GitHub Releases + `frontend/public/install.sh` (CLI — tag `cli-v*` triggers `.github/workflows/release-cli.yml`)

## Milestones

- M1: rename + rip — packages renamed to `@distrotv/*`, ads ripped, slot types added
- M2: auth + device registration
- M3: news slot rendering
- M4: ticker slot + watchlist
- M5: demo loop end-to-end → merge to main
- M6: dashboard polish (shipped)
- M7: admin dashboard (shipped)
- M8: landing page + install vector (shipped — channels positioning, curl/GH Releases install)

## Hard Rules

- &lt;200ms slot vanish — hard requirement, measure it, log it
- hooks always exit 0 — never block Claude Code
- local ledger is ground truth — backend can be down
- 3s grace period before showing slots — no slots on fast tool calls
- **lead with _channels_ as the surface noun, never with "news + markets"** — Distro TV is a channel platform; NEWS and MARKETS are the two launch channels; future verticals slot into the same surface. Marketing, docs, and product copy must reflect this. The two-tangent "news AND market data" framing is what we explicitly pivoted away from in M8.
- **CLI distribution = `curl -fsSL https://distrotv.xyz/install.sh | sh` + GitHub Releases, never npm publish.** install.sh lives at `frontend/public/install.sh` and pulls the latest tarball from `releases/latest/download/distrotv-cli.tar.gz`. Releases are triggered by pushing a `cli-v*` git tag. See `gitbook-docs/cli/releases.md`.

## Dev Rules

- load frontend-design skill for anything frontend
- minimal comments, crisp pointers, lowercase start
- never mention claude or ai in commits, keep messages crisp
- after each notion task: post completion comment: key decisions, gotchas, tick AC checkboxes
- post every significant changes lets keep updating and maintaining engineering gitbook-docs
