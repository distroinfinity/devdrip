# CLAUDE.md

## Project Overview

Distro is **the ad exchange for AI agent surfaces**. Agents do the work while people wait; that wait is a new attention surface with no market layer. The first surface is the developer's terminal: Distro TV shows **sponsored slots while AI coding tools work** and shares the ad revenue with the viewer (ads are the default feed). **CH 01 NEWS**, **CH 02 MARKETS** and **CH 03 UTILITIES** are opt-in channels on the same surface for people who'd rather not see ads. Long-term: an **open ad exchange for AI agent surfaces** — anyone can bid for slots the way they do for web display or a billboard; the terminal is the first inventory. History: launched as DevDrip (opt-in ads + USDC micropayments), pivoted to channels-only Distro TV in May 2026, re-centered on ads in Sep 2026 — without crypto.

## Architecture

- **CLI + Daemon** — `@distrotv/cli` distributed via GitHub Releases + `curl ... | sh` install script (NOT npm). Binary: `distro`, alias `dtv`. Hooks into Claude Code via settings.json (PreToolUse, Stop, UserPromptSubmit). Daemon on Unix socket manages slot display, key capture, local ledger (SQLite).
- **Backend API** — Express + Drizzle ORM + Railway Postgres + Upstash Redis. Auth, device registration, channels, watchlists, alerts, slot impression ingestion.
- **Dashboard** — Next.js 14, App Router, Tailwind. Reading list, watchlist management, preferences.
- **Ads** — API owns supply: advertiser-written direct ads (`ad_campaigns`, portal at `/advertisers/portal`, highest bid first) → Carbon Ads (sandbox) → house-ad fallback, served as `sponsored` slots through `/me/content/next`. Each served ad is a row in `ad_impressions` (the delivery record); `/ingest` marks it seen, `GET /c/:code` (short) and `GET /ads/click/:deliveryId` record the click and redirect. See `gitbook-docs/architecture/ads.md`.
- **Payments** — none. Advertisers pay Distro, Distro pays the developer a share and keeps a margin. Earnings are **estimated** internally as `AD_CPM_RATE`/1000 × `REVENUE_SHARE_DEVELOPER` per viewable ad; neither number is shown to users. The dashboard shows a disabled "Payouts — coming soon" button. No crypto, wallets, or USDC.

## Tech Stack

- **everything TypeScript** — monorepo via Turborepo + pnpm workspaces
- packages: `cli`, `api`, `dashboard`, `shared`
- Express, Drizzle, Railway Postgres, Upstash, better-sqlite3, commander, tsup
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
- M9: terminal ads (hackathon, branch `hackathon/terminal-ads`) — sponsored slots on by default, estimated revenue dashboard, channels opt-in, ads-first landing + `/advertisers` exchange page. local only; not released.

## Hard Rules

- &lt;200ms slot vanish — hard requirement, measure it, log it
- hooks always exit 0 — never block Claude Code
- local ledger is ground truth — backend can be down
- no grace period before showing slots — surface as soon as Claude takes over (`GRACE_PERIOD_MS = 0`). Fast tool calls are gated by the slot vanish timer + frequency caps, not by a pre-show delay.
- **lead with the exchange, and tell the story — never pitch.** Headline: _"The ad exchange for AI agent surfaces."_ The arc: every new medium grew an ad market → AI agents created a new attention surface (the wait) → nothing serves it → Distro is the open exchange for it → the terminal is the first surface, live today. Read like infrastructure, not a consumer offer: no "get paid" headlines, no benefit-led selling. Never surface product defaults (e.g. "ads on by default") in marketing. Channels (news, markets, utilities) appear as "the slot isn't only for ads", never as the headline. Status tags must be honest: _live_ / _next_ / _planned_ — never imply bidding or self-serve exists.
- **money is always labeled _estimated_** until real payouts exist. No crypto, wallet, or USDC language anywhere.
- **never publish the split or exact rates.** The revenue structure in public copy is: _advertisers pay Distro TV, Distro TV pays the developer a share, and keeps a margin_. No "70%", no CPM figures, on the site, dashboard or CLI. The developer angle: idle agent time earns money and helps pay for the AI tools that cause it. (`REVENUE_SHARE_DEVELOPER` and `AD_CPM_RATE` stay internal.)
- **ad-platform marks (Google Ads, Meta, Amazon) appear only as monochrome icons beside their names**, in the theme's ink colour, on "import — coming soon" tiles (`frontend/components/advertisers/brand-mark.tsx`). They name a planned import, never a partnership. No full-colour logos, no marks anywhere else. Check each brand's guidelines before a public launch — Amazon in particular restricts use (its icon was pulled from simple-icons).
- **the product name is _Distro TV_, always in full** in user-facing copy (site, dashboard, CLI, docs) — never bare "Distro". Don't write "Distro is building it" style filler lines.
- **copy is short, plain and precise.** Short sentences. One idea each. Say a thing once per page: if the demo shows it, the text doesn't repeat it. The landing page is four sections — thesis, lineage, how the money moves, two doors (developers / advertisers). Don't add sections to it without removing one.
- **ad clicks go through our redirect** (`/c/:code` or `/ads/click/:deliveryId`). The redirect target comes only from the server-side delivery row, never from the request.
- **an ad pays only if it was on screen ≥ 1s and not skipped.** The same rule lives in the API (`computeEarned`) and the CLI ledger (`sumTodayOptimistic`) — change both together.
- **the sponsored panel prints the full click URL.** Terminals make a visible `http(s)://` URL cmd/ctrl-clickable; that is the only same-terminal click that needs no key capture. Never truncate it. Every panel row starts with the `▍` bar because Claude Code strips leading whitespace from status lines.
- **CLI distribution = `curl -fsSL https://get.distrotv.xyz/install.sh | sh` + GitHub Releases, never npm publish.** install.sh is served from **GitHub Pages at `get.distrotv.xyz`**, NOT Vercel — Vercel's edge firewall JS-challenges `curl` (`x-vercel-mitigated: challenge`), which `curl | sh` can't solve. Source file is `frontend/public/install.sh` (single source of truth), deployed by `.github/workflows/deploy-install.yml`; it pulls the latest tarball from `releases/latest/download/distrotv-cli.tar.gz`. Releases are triggered by pushing a `cli-v*` git tag. install.sh lays out a **versioned install** — each release lands in `~/.distrotv/versions/<v>/`; `~/.distrotv/current` symlink points at the active version; shims and Claude hook entries resolve through `current/dist/index.js`. the CLI **auto-updates** on the daemon's tick: the **version signal comes from our API** (`GET /cli/version-check`, gated by `LATEST_CLI_VERSION` env var on Railway — unset = no update advertised); tarballs still live on GitHub Releases. set `LATEST_CLI_VERSION=<version>` after each release to roll out; unset to halt. opt-out: `DISTRO_NO_AUTOUPDATE=1` or `cli.autoUpdate: false`. See `gitbook-docs/cli/releases.md`.

## Dev Rules

- local dev: `scripts/dev-link-cli.sh` points `~/.distrotv/current` + the `distro`/`dtv` shims at this checkout's CLI build (hooks, status line and daemon then run the working tree). API on `:3011`, web on `:3010`, Postgres via docker compose.
- load frontend-design skill for anything frontend
- minimal comments, crisp pointers, lowercase start
- never mention claude or ai in commits, keep messages crisp
- after each notion task: post completion comment: key decisions, gotchas, tick AC checkboxes
- post every significant changes lets keep updating and maintaining engineering gitbook-docs
