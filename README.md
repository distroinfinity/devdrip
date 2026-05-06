# Distro TV

Your terminal's news + market feed, while the agent works. An ambient slot anchored at the bottom of your terminal during AI-coding-tool idle time. Tech + finance news from HN / TechCrunch / Bloomberg / Reuters. A watchlist of stocks + crypto with sparklines and key stats.

## Modes

- **news** — every slot is news (HN, TechCrunch, Bloomberg, Reuters, etc.)
- **markets** — every slot is a ticker from your watchlist
- **mix** — alternates news + markets; alert-driven priority bumps a ticker when it moves >5%

Pick one during `distro init`; flip any time with `distro preferences`.

## Structure

```
frontend/          # Next.js landing + dashboard (Vercel)
packages/
  cli/             # @distrotv/cli — Claude Code hooks + daemon + slot renderer
  api/             # Express backend — auth, channels, watchlists, alerts
  shared/          # @distrotv/shared — slot payload types, DTOs
docs/              # specs, design docs
gitbook-docs/      # engineering reference; mirrors github.io
```

## Local dev quickstart (post-M1)

```bash
pnpm clean && pnpm install && pnpm build
docker compose up -d postgres
pnpm --filter @distrotv/api db:migrate
pnpm --filter @distrotv/api dev   # one shell
node packages/cli/dist/index.js init   # another shell
node packages/cli/dist/index.js daemon start
```

After M1, `distro init` writes hooks but slot rendering arrives in M3 (news) and M4 (tickers).

## Deploy

- API: Railway autodeploy from `main`
- Frontend: GitHub Actions → Vercel after CI succeeds
- CLI: published to npm as `@distrotv/cli` via `pnpm release`

## Specs

- Active pivot spec: `docs/superpowers/specs/2026-05-05-distro-tv-pivot-design.md`
- Plan overview: `docs/superpowers/plans/2026-05-05-distro-tv-overview.md`
