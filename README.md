# Distro TV

**The ad exchange for AI agent surfaces.**

AI agents do the work. People wait and watch. That attention has no market yet. Distro TV is
that market, starting in the terminal.

Every medium grew an ad market: print, broadcast, the web, mobile. Agent tools are the first
major surface with none. While a coding agent runs, a developer watches a terminal for thirty
seconds, two minutes, ten. Distro TV puts one text ad in that wait, pays the developer a share,
and clears the instant they type.

## How it works

```
advertiser ──writes an ad, sets a bid──▶ Distro TV ──serves by bid──▶ developer's terminal
     ▲                                       │                              │
     └────── views · clicks · spend ─────────┴──── pays the viewer a share ◀┘
```

1. **Advertisers pay Distro TV.** They write a one-line text ad in the portal and set a CPM bid.
   Only views of a second or more count.
2. **Distro TV runs the exchange.** Highest bid first, then network fill (Carbon Ads sandbox),
   then house ads. It keeps a margin.
3. **Developers get paid.** Idle agent time earns money. It helps pay for the AI tools that
   cause it.

Opt-in only. The slot clears when you type. Prefer no ads? Tune the slot to news or markets.

## What is in the box

| Part              | What it does                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cli`    | `distro` / `dtv`. Hooks into Claude Code, runs a small daemon, renders the ad in the status line, records views in a local SQLite ledger, syncs them within seconds. |
| `packages/api`    | Express + Postgres. Ad supply, delivery records, the pay rule, click redirects, earnings, the advertiser API.                                                        |
| `frontend`        | Next.js. Landing page, developer dashboard with a live revenue page, advertiser page and ad portal.                                                                  |
| `packages/shared` | Types and constants shared by all three.                                                                                                                             |

The ad, as a developer sees it:

```
▍ AD  Lumen Deploy                                               +$0.0175
▍ Deploys that finish before your coffee does.
▍ ↗ https://api.distrotv.xyz/c/2472fa528d42  ⌘ click      est. today $3.42
```

The link is a real URL on purpose: terminals make any visible `https://` link ⌘-clickable, so
the click works inside the same terminal with no key capture.

## What the exchange does today

- ad supply: advertiser-written ads served by bid, then Carbon Ads (sandbox), then house ads
- delivery records, a viewability pay rule (on screen ≥ 1s, not skipped), replay-safe ingest
- tracked click redirects with short links, and a same-terminal ⌘-click
- ads as the default feed; news and markets as opt-in channels on the same slot
- a live revenue dashboard: counting balance, per-agent-hour rate, 1h / 24h / 30d chart
- an advertiser portal: write an ad, set a bid, watch views and clicks, pause

How it relates to AI: Distro TV is infrastructure for AI agent tools. It integrates with Claude
Code through its hooks and status line, and turns the time an agent spends working into an ad
surface.

## Run it locally

Needs Node 20+, pnpm, Docker.

```bash
pnpm install
docker compose up -d postgres                 # local Postgres
cp packages/api/.env.example packages/api/.env   # fill in GitHub OAuth + secrets
pnpm --filter @distrotv/api db:migrate
pnpm --filter @distrotv/api dev               # api on :3011
cd frontend && pnpm exec next dev -p 3010     # web on :3010

pnpm --filter @distrotv/shared build && pnpm --filter @distrotv/cli build
scripts/dev-link-cli.sh                       # point ~/.distrotv at this checkout
DISTRO_ENV=local dtv init                     # pair with GitHub, install the Claude Code hooks
```

Open a Claude Code session and give the agent a task. The ad appears in the status line.

- Revenue: <http://localhost:3010/dashboard/revenue>
- Ad portal: <http://localhost:3010/advertisers/portal>

## Status, plainly

- Live: terminal surface, ad serving, views and clicks measured end to end, revenue dashboard,
  advertiser portal.
- Sandbox: network ads come from Carbon's demo zone. All money is an **estimate**. Nothing is
  charged and nothing is paid out yet.
- Planned: importing ads from Google Ads, Meta Ads and Amazon Ads; budgets and targeting; an ad
  review queue; more surfaces (IDE agent panels, agent web apps).

More detail: [`gitbook-docs/architecture/ads.md`](gitbook-docs/architecture/ads.md) ·
demo script: [`docs/demo-script.md`](docs/demo-script.md).
