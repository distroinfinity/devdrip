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
- deploy: Railway GitHub autodeploy (API), Vercel (frontend + landing at distrotv.xyz), GitHub Releases (CLI tarball — tag `cli-v*` triggers `.github/workflows/release-cli.yml`) + GitHub Pages at `get.distrotv.xyz` for `install.sh` (`.github/workflows/deploy-install.yml`)

## Milestones

- M1: rename + rip — packages renamed to `@distrotv/*`, ads ripped, slot types added
- M2: auth + device registration (replaced 2026-05-22 by mandatory GitHub OAuth — see `gitbook-docs/architecture/auth.md`; cli-v0.2.0)
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
- no grace period before showing slots — surface as soon as Claude takes over (`GRACE_PERIOD_MS = 0`). Fast tool calls are gated by the slot vanish timer + frequency caps, not by a pre-show delay.
- **lead with _channels_ as the surface noun, never with "news + markets"** — Distro TV is a channel platform; NEWS and MARKETS are the two launch channels; future verticals slot into the same surface. Marketing, docs, and product copy must reflect this. The two-tangent "news AND market data" framing is what we explicitly pivoted away from in M8.
- **CLI distribution = `curl -fsSL https://get.distrotv.xyz/install.sh | sh` + GitHub Releases, never npm publish.** install.sh is served from **GitHub Pages at `get.distrotv.xyz`**, NOT Vercel — Vercel's edge firewall JS-challenges `curl` (`x-vercel-mitigated: challenge`), which `curl | sh` can't solve. Source file is `frontend/public/install.sh` (single source of truth), deployed by `.github/workflows/deploy-install.yml`; it pulls the latest tarball from `releases/latest/download/distrotv-cli.tar.gz`. Releases are triggered by pushing a `cli-v*` git tag. install.sh lays out a **versioned install** — each release lands in `~/.distrotv/versions/<v>/`; `~/.distrotv/current` symlink points at the active version; shims and Claude hook entries resolve through `current/dist/index.js`. the CLI **auto-updates** on the daemon's ~15-min check (opt-out: `DISTRO_NO_AUTOUPDATE=1` or `cli.autoUpdate: false`). See `gitbook-docs/cli/releases.md`.

## Dev Rules

- load frontend-design skill for anything frontend
- minimal comments, crisp pointers, lowercase start
- never mention claude or ai in commits, keep messages crisp
- after each notion task: post completion comment: key decisions, gotchas, tick AC checkboxes
- post every significant changes lets keep updating and maintaining engineering gitbook-docs
