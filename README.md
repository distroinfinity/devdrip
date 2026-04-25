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
gitbook-docs/      # engineering reference; mirrors github.io
```

## Local dev quickstart

End-to-end loop: build → API → daemon → onboard CLI → use Claude Code → see ads.

```bash
# 0. wipe stale dists (incremental tsc lies; build outputs go out of sync after branch switches)
pnpm clean && rm -rf packages/shared/tsconfig.tsbuildinfo packages/cli/tsconfig.tsbuildinfo

# 1. install + clean build (turbo orders shared → cli → api)
pnpm install && pnpm build

# 2. run the API in one shell (defaults to dockerized local Postgres; see gitbook-docs/engineering/dev-workflow.md for the full env matrix)
pnpm --filter @devdrip/api dev

# 3. NEW SHELL — onboard the CLI: GitHub auth, register device, install Claude hooks, refresh the ~/.devdrip/bin/devdrip symlink
node packages/cli/dist/index.js init

# 4. start the background daemon (idempotent — running twice prints "daemon already running")
node packages/cli/dist/index.js daemon start

# 5. verify daemon is healthy
node packages/cli/dist/index.js daemon status
tail -f ~/.devdrip/daemon.log     # in a separate shell while you test

# 6. open Claude Code in any project and submit any prompt — within ~1.5s an ad
#    renders at the bottom of the terminal (highlight border, [D]iscover [S]kip
#    [K]ill [M]ute footer, progress bar). Press d/s/k/m/Esc to act on it.
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
