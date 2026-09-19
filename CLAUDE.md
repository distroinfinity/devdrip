# CLAUDE.md

## Project Overview

Dev Drip is an ad-subsidized developer tool that monetizes AI coding tool idle time (while agents think/run) with opt-in, non-intrusive content. Developers earn USDC micropayments on Base that offset their AI tool subscriptions to some extent.

## Sprint Plan Reference

The master execution plan lives in Notion: https://www.notion.so/Sprint-Plan-Dev-Drip-Execution-3144bbb2d003816aa069f0bc02572809

Each task page contains: **Definition** (what to build), **Expectations** (what good looks like), **Acceptance Criteria** (binary done/not-done checks), **Gotchas & Notes for Next Task** (traps and handoff context). The "Blocked By" field references other task IDs — don't start a blocked task until its dependency is done.

## Repository Structure

- `docs/Dev_Drip_PRD.md` — Full product requirements document (problem statement, case studies, product spec, technical architecture, revenue model)
- `docs/DESIGN_SYSTEM.md` — Brand guide and design language ("Industrial Paper" aesthetic). Covers brand philosophy, color system, typography, component specs
- `docs/DESIGN_TOKENS.md` — All design tokens as CSS custom properties, plus Tailwind config extension and font usage reference
- `docs/DEV_DRIP_LANDING_PAGE_BLUEPRINT.md` — Landing page messaging strategy, section architecture, and content spec
- `docs/dev-drip-design-system.jsx` — React reference implementation of the design system (color swatches, typography specimens, EarningsCounter, TerminalTV components)
- `docs/marketResearch.md` — Market viability analysis with competitive landscape, ad economics, and developer psychology research

## Design System — Key Constraints

- **Three typefaces**: Space Mono (headlines/display), DM Sans (body/UI), JetBrains Mono (all financial data, code, addresses)
- **Light mode = "Paper"** (warm white `#F7F6F3`, dark ink `#0E0E11`); Dark mode = "Terminal" (near-black `#0A0A0C`, bright ink `#EDEDF0`)
- **Dot-grid texture** is the primary atmospheric element (16px spacing, 1px dots)
- **Ads vanish in <200ms** when developer resumes activity (`--ease-vanish: 120ms ease-in`)

## Product Principles (from PRD)

- Opt-in only — the developer initiates every ad interaction
- Show the machinery — expose USDC flows, CPM math, ad lifecycle states. Transparency IS the trust signal
- Ads are content, not interruptions — developer tool discovery framed as genuinely useful
- Developer controls: `[S]kip`, `[K]ill`, `[M]ute 30min` keybindings on every ad surface
- "Appear on idle, vanish on active" — like Waze's zero-speed takeover pattern
- No selling, only demonstrating — tone reads like a README.md, not a SaaS marketing page

## Tech Stack (from Sprint Plan)

| Layer | Stack |
|-------|-------|
| Backend API | Go (net/http or Gin), PostgreSQL, Redis |
| CLI / Terminal SDK | TypeScript (Node.js), ANSI rendering |
| VS Code Extension | TypeScript, VS Code Extension API, WebView |
| Dashboard & Web | Next.js + TypeScript, Tailwind |
| Payments | USDC on Base (Coinbase L2), ethers.js |
| Desktop Widget | Electron or Tauri |
| Infra | Docker, fly.io or Railway, GitHub Actions CI |

## Execution Phases

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| **Phase 0** | Landing Page | Public-facing landing page with interactive demos, waitlist, HN-ready launch |
| Phase 1 | Terminal-Only Beta | Terminal TV + Digest + USDC payouts for 1K invite-only devs |
| Phase 2 | VS Code Extension | Companion Tab + Sponsored Challenges + ML targeting for 10K open beta |
| Phase 3 | Full Platform | All 6 surfaces + programmatic ads + 100K devs + international |
| Phase 4 | Partnerships & Scale | Native AI tool integrations + enterprise advertisers + OSS fund at scale |

## Phase 0: Landing Page — Task Map

Current phase. Tasks are ordered with dependency chains (`Blocked By` field).

| ID | Task | Priority | Category | Blocked By |
|----|------|----------|----------|------------|
| P0-001 | Next.js Project Setup & Design System Integration | Critical | Infra | None |
| P0-002 | Reusable Component Library — Core Primitives | Critical | Frontend | P0-001 |
| P0-003 | Hero Section — First Fold | Critical | Frontend | P0-002 |
| P0-004 | "The Dead Time" — Problem Statement Section | High | Frontend | P0-002 |
| P0-005 | "How It Works" — Three-Step Flow + Vanish Demo | High | Frontend | P0-002 |
| P0-006 | "The Surfaces" — Ad Surface Showcase | High | Frontend | P0-002 |
| P0-007 | "Your Rules" — Developer Controls Section | High | Frontend | P0-002 |
| P0-008 | "The Math" — Revenue Breakdown | High | Frontend | P0-002 |
| P0-009 | "The Payment Rail" — USDC on Base Explainer | High | Frontend | P0-002 |
| P0-010 | "Open Source Fund" — 5% to Maintainers | Medium | Frontend | P0-002 |
| P0-011 | "For Developers Worldwide" | Medium | Frontend | P0-002 |
| P0-012 | FAQ — Objection Handling Accordion | High | Frontend | P0-002 |
| P0-013 | Footer, Section Transitions & Dark Mode Toggle | High | Frontend | P0-001 |
| P0-014 | Scroll Orchestration, Animations & Page Assembly | High | Frontend | P0-003–P0-013 (all sections) |
| P0-015 | Waitlist Backend — Email Collection API + Storage | High | Backend | P0-001 |
| P0-016 | SEO, OG Image & Analytics Setup | High | Full Stack | P0-014 |
| P0-017 | Mobile Responsiveness & Cross-Browser QA | High | QA | P0-016 |
| P0-018 | Pre-Launch QA & HN Readiness Audit | Critical | QA | P0-017 |

**Landing page section order:** Hero → Dead Time → How It Works → Surfaces → Your Rules → The Math → Payment Rail → Open Source Fund → Worldwide → FAQ → Waitlist + Footer

## Phase 0 Key Technical Decisions

- **Package manager**: pnpm
- **Framework**: Next.js 14+ with App Router, TypeScript strict mode
- **UI libraries**: shadcn/ui (base primitives, restyled to monochrome), MagicUI (`Dot Pattern`, `Number Ticker`, `Terminal`, `Blur Fade`, `Scroll Progress`, `Typing Animation`), Aceternity (`Encrypted Text`, `Typewriter Effect`, `Tabs`, `Timeline`, `Sticky Scroll Reveal`)
- **Animation**: framer-motion
- **Fonts**: All via `next/font/google` with `display: swap` — Space Mono (400, 700), DM Sans (400–700), JetBrains Mono (400, 500, 700)
- **Folder structure**:
  ```
  app/
    page.tsx              — landing page (single page)
    layout.tsx            — root layout with fonts + theme
  components/
    ui/                   — shadcn + magicui + aceternity primitives
    landing/              — page section components
    shared/               — DotGrid, EarningsCounter, TerminalTV, etc.
  lib/
    design-tokens.ts      — exported token values for JS usage
  styles/
    tokens.css            — CSS custom properties from DESIGN_TOKENS.md
  ```

## Technical Context (from PRD)

- USDC payments on Base (Coinbase L2) — $0.001-$0.002 transaction fees
- Ad surfaces: Terminal TV (CLI overlay), VS Code sidebar tab, floating desktop widget
- Revenue split: 65-70% to developer, 30-35% platform
- Ad formats: native display ($2-5 CPM), rewarded video ($15-30 CPM), interactive demos

## When Building

- Reference `docs/DESIGN_TOKENS.md` for the Tailwind config extension — it has the exact `fontFamily`, `colors`, `fontSize`, and `borderRadius` values to use
- Reference `docs/dev-drip-design-system.jsx` for component patterns (EarningsCounter with glow animation, TerminalTV with progress bar, DotGrid background)
- The landing page spec is in `docs/DEV_DRIP_LANDING_PAGE_BLUEPRINT.md` — it defines exact section order, messaging, and interactive demos to build

## Rules

- load frontend-design skill to plan or execute anything frontend related
- use minimal comments, crisp pointers starting from smaller letters. This doesn't mean skip comments entirely so that its dificult later to track and udnerstand code
- Never mention claude or ai in commit messages or as co author, keep commit message crisp and sharp no need to bloat commit messages