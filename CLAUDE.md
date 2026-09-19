# CLAUDE.md

## Project Overview

Dev Drip monetizes AI coding tool idle time with opt-in ads. Developers earn USDC micropayments while Claude Code thinks. Phase 0 (landing page) complete. Phase 1: working product — CLI, backend API, dashboard, USDC payouts.

## Architecture

- **CLI + Daemon** — `@devdrip/cli` npm package. Hooks into Claude Code via settings.json (PreToolUse, Stop, UserPromptSubmit). Daemon on Unix socket manages ad display, key capture, local ledger (SQLite).
- **Backend API** — Express + Drizzle ORM + Neon PostgreSQL + Upstash Redis. Campaign management, ad waterfall (Manual → Carbon Ads), impression ingestion, earnings, payouts.
- **Dashboard** — Next.js 14, App Router, Tailwind. Earnings, analytics, preferences, wallet, claim USDC.
- **Payments** — x402 protocol for everything. EIP-3009 + CDP facilitator (gasless). Base Sepolia testnet.

## Tech Stack

- **everything TypeScript** — monorepo via Turborepo + pnpm workspaces
- packages: `cli`, `api`, `dashboard`, `shared`
- Express, Drizzle, Neon, Upstash, wagmi, viem, @x402/evm, better-sqlite3, commander, tsup
- deploy: Railway (API), Vercel (dashboard), npm (CLI)

## Sprint Reference

- Notion board: https://www.notion.so/b0675f57e5a3481ebb76c823d889ac95
- Sprint overview: https://www.notion.so/3404bbb2d003812e81f2c1ab6c21d91b
- 61 tickets, 5 sprints, 4 parallel tracks (Infra, Backend, CLI, Frontend)

## Hard Rules

- <200ms ad vanish — hard requirement, measure it, log it
- hooks always exit 0 — never block Claude Code
- local ledger is ground truth — backend can be down
- 3s grace period before showing ads — no ads on fast tool calls

## Rules

- load frontend-design skill for anything frontend
- minimal comments, crisp pointers, lowercase start
- never mention claude or ai in commits, keep messages crisp
- when completing a Notion ticket, post completion comment: key decisions, gotchas, tick AC checkboxes
