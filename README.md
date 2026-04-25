# Dev Drip

Opt-in ads during AI coding tool idle time. Developers earn USDC micropayments while their agent thinks.

## Structure

```
frontend/          # Next.js landing page + dashboard (Vercel)
packages/
  cli/             # @devdrip/cli — Claude Code hooks + daemon + terminal renderer
  api/             # Express backend — ads, impressions, earnings, payouts
  dashboard/       # dashboard routes (or merged into frontend/)
  shared/          # shared types + constants
docs/              # PRD, design system, design tokens, market research
```

## Setup

```bash
pnpm install
pnpm build
```

## Deploy

- API: Railway GitHub autodeploy from `main`
- Frontend: GitHub Actions deploy to Vercel after `CI` succeeds

## Sprint Board

https://www.notion.so/b0675f57e5a3481ebb76c823d889ac95
