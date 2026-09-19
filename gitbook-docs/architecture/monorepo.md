# Monorepo Layout

## Workspace Layout

```text
frontend/
packages/
  api/
  cli/
  contracts/   (Foundry — Uniswap v4 hook for CH 03 ONCHAIN)
  dashboard/   (app shell — merged into frontend/ for most product surfaces)
  shared/
docs/
gitbook-docs/
```

## Tooling

- package manager: `pnpm@10`
- monorepo orchestration: `turbo`
- language: TypeScript
- Node requirement: `>=20`

## Root Scripts

- `pnpm build`
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm release`
- `pnpm format`

These dispatch through Turbo. Package-level behavior lives inside each workspace.

## Package Breakdown

## `frontend`

- Next.js 14 app
- public landing page at `distrotv.xyz`
- dashboard at `/dashboard/*` (auth-gated)
- hosts `install.sh` at `frontend/public/install.sh`
- Tailwind-based UI with `@distrotv/design-system` tokens
- Vercel analytics

## `packages/api`

- Express 5 app
- Drizzle schema and migrations
- magic-link auth + device bearer auth
- Upstash-backed rate limiting and pairing codes
- Pino logging
- news fetcher + ticker fetcher workers (node-cron)
- alert evaluator runs inside ticker tick

## `packages/cli`

- Commander CLI
- binary: `distro` (alias: `dtv`)
- distributed via curl + GitHub Releases (`cli-v*` tag → `release-cli.yml`)
- daemon on Unix socket: slot cache, key capture, local SQLite ledger

## `packages/contracts`

- Foundry project for `CH 03 ONCHAIN — LP GUARD`
- `DistroGuardHook.sol` — Uniswap v4 hook (volatility/size-aware dynamic fee), built on v4-core 1.0.2, extends `BaseTestHooks`
- vendored `HookMiner` (`script/HookMiner.sol`); v4-core / v4-periphery / forge-std under `lib/`
- `script/Deploy.s.sol` self-deploys a PoolManager + v4-core test routers, mines + deploys the hook, inits the dynamic-fee pool, writes `export/addresses.<chainId>.json` + the ABI
- live on X Layer testnet (chainId 1952); see [Onchain LP Guard](onchain-lp-guard.md)

## `packages/dashboard`

- separate Next.js app shell
- most dashboard product surfaces now live in `frontend/app/dashboard/`

## `packages/shared`

- shared enums: `ChannelMode`, `SlotKind`, `ImpressionResult`, `IDE type`
- shared slot payload types: `NewsPayload`, `TickerPayload`, `SlotContent`
- `env-bundle.ts`: `local | staging | prod` URL bundles for API + web + email from address

## Environment Boundaries

## `frontend/.env.example`

- `NEXT_PUBLIC_SITE_URL`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `IP_HASH_SALT`
- `DISTRO_ENV` / `NEXT_PUBLIC_DISTRO_ENV`

## `packages/api/.env.example`

- local and Neon Postgres URLs
- JWT secret
- Resend API key (magic-link emails)
- Upstash Redis credentials
- `ALLOWED_ORIGINS`
- `DB_TARGET`
- `DISTRO_ENV`
- Finnhub and CoinGecko API keys

## `packages/dashboard/.env.example`

- `NEXT_PUBLIC_API_URL`

## Build and Runtime Notes

- Turbo is required for root-level build, test, and typecheck
- the repo contains two Next.js apps (`frontend` and `packages/dashboard`) but the dashboard package is a minimal shell; most product UI lives in `frontend`
