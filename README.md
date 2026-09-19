# Dev Drip

Opt-in content during AI coding tool idle time — earn or learn while your agent thinks. Developers earn USDC micropayments from ads, or fill the slot with HN tech news instead, or alternate both.

## Modes

- 📰 **learn** — tech news only, no ads, no earnings
- 💰 **earn** — ads only, full USDC payouts
- 🎭 **both** — alternates news and ads (default)

Pick one during `devdrip init`; flip any time with `devdrip preferences` or the dashboard mode toggle.

## Structure

```
frontend/          # Next.js landing page + dashboard (Vercel)
packages/
  cli/             # @devdrip/cli — Claude Code hooks + daemon + terminal renderer
  api/             # Express backend — ads, impressions, earnings, payouts
  dashboard/       # dashboard routes (or merged into frontend/)
  shared/          # shared types + constants
docs/              # PRD, design system, design tokens, market research
gitbook-docs/      # engineering reference; mirrors github.io
```

## Local dev quickstart

End-to-end loop: build → API → daemon → onboard CLI → use Claude Code → see ads.

```bash
# 0. wipe stale dists (incremental tsc lies; build outputs go out of sync after branch switches)
pnpm clean && rm -rf packages/shared/tsconfig.tsbuildinfo packages/cli/tsconfig.tsbuildinfo

# 1. install + clean build (turbo orders shared → cli → api)
pnpm install && pnpm build

# 2. bring up local Postgres (required — API exits fast if this isn't running)
docker compose up -d postgres

# 3. run the API in one shell (defaults to dockerized local Postgres; see gitbook-docs/engineering/dev-workflow.md for the full env matrix)
pnpm --filter @devdrip/api dev

# 4. NEW SHELL — onboard the CLI: GitHub auth, register device, install Claude hooks, refresh the ~/.devdrip/bin/devdrip symlink
node packages/cli/dist/index.js init

# 5. start the background daemon (idempotent — running twice prints "daemon already running")
node packages/cli/dist/index.js daemon start

# 6. verify daemon is healthy
node packages/cli/dist/index.js daemon status
tail -f ~/.devdrip/daemon.log     # in a separate shell while you test

# 7. open Claude Code in any project and submit any prompt — within ~1.5s a
#    slot renders at the bottom of the terminal (ad or news headline, depending
#    on your mode). Press [D] open / [S] skip / [K] kill / [M] mute / Esc.
#    News mode also: [B] save to reading list (visible at /dashboard/reading).
claude
```

After `init`, `~/.devdrip/bin/devdrip` is symlinked to the CLI you just built. You can either invoke that path directly or add it to your PATH so plain `devdrip <cmd>` works:

```bash
echo 'export PATH="$HOME/.devdrip/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

### When something looks wrong

- **No ads showing**: check `~/.devdrip/daemon.log` for `ad suppressed by preferences reason=…`. Most common reasons: `hourly-cap` (your `~/.devdrip/config.json` may still hold pre-PR-41 caps — bump with `devdrip config --set maxPerHour=9999`), `warmup` (first 0–60s of a session depending on prefs), `quiet-hours`, `muted`.
- **Old renderer or no key capture**: the daemon caches the JS module in memory at spawn time. If you rebuild the CLI, restart with `devdrip daemon stop && devdrip daemon start` so the new dist gets loaded.
- **Layout collisions with Claude's TUI**: the renderer uses DECSTBM scroll-region anchoring — if Claude Code switches to alt-screen the anchor won't survive. Open an issue with a screenshot.

Full env matrix, Postgres setup, and worktree workflow live in `gitbook-docs/engineering/dev-workflow.md`.

## Setup (no Claude integration, just dependencies)

```bash
pnpm install
pnpm build
```

## Deploy

- API: Railway GitHub autodeploy from `main`
- Frontend: GitHub Actions deploy to Vercel after `CI` succeeds
- CLI: published to npm via `pnpm release` (Turborepo builds `@devdrip/cli` then `pnpm publish --access public`)

## Sprint Board

https://www.notion.so/b0675f57e5a3481ebb76c823d889ac95
