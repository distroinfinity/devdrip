# Dev Workflow

## Prerequisites

- Node 20+
- pnpm 10+
- Docker (for local Postgres — see below) or a Neon connection string
- GitHub OAuth app credentials for auth flow testing
- Upstash Redis credentials only for production-like rate-limit testing; in development (`NODE_ENV=development` without `UPSTASH_REDIS_REST_URL`) the API falls back to an in-memory store

## Local Postgres via Docker Compose

Local dev runs against a Dockerized Postgres, never the Neon DB. A `docker-compose.yml` at the repo root defines the service; all worktrees share one container via compose project name `devdrip-dev`. The API startup guard refuses `NODE_ENV=development` + `DB_TARGET=neon` unless `DEVDRIP_ALLOW_NEON_IN_DEV=1` is set.

**Secrets handling:** the compose file requires `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` via `${VAR:?…}` interpolation — no literals live in committed sources. Real values go in a **gitignored `.env` at the repo root**; `.env.example` documents the shape with `change-me` placeholders. `setup-worktree.sh --db-up` bootstraps `.env` with local-only defaults on first run. If you change `POSTGRES_PASSWORD`, update `DATABASE_URL_LOCAL` in `packages/api/.env` to match.

From inside a worktree:

```bash
# bring up postgres + wait for healthy
bash ~/.superset/worktrees/devdrip/setup-worktree.sh --db-up

# apply migrations against it
pnpm --filter @devdrip/api db:migrate

# status / stop / wipe (with confirmation)
bash ~/.superset/worktrees/devdrip/setup-worktree.sh --db-status
bash ~/.superset/worktrees/devdrip/setup-worktree.sh --db-down
bash ~/.superset/worktrees/devdrip/setup-worktree.sh --db-reset
```

A fresh worktree can skip most of this — the full-setup mode does it automatically:

```bash
bash ~/.superset/worktrees/devdrip/setup-worktree.sh
# → pnpm install → .env copy → docker up → wait healthy → migrate → tests
```

### Env matrix

| Variable                    | development (default)                                   | test                   | staging/production                 |
| --------------------------- | ------------------------------------------------------- | ---------------------- | ---------------------------------- |
| `NODE_ENV`                  | `development`                                           | `test` (set by vitest) | `production`                       |
| `DISTRO_ENV`                | `local`                                                 | `local`                | `staging` / `prod`                 |
| `DB_TARGET`                 | `local`                                                 | unset (tests mock DB)  | `neon`                             |
| `DATABASE_URL_LOCAL*`       | `postgres://devdrip:devdrip@localhost:5432/devdrip_dev` | —                      | —                                  |
| `DATABASE_URL*`             | commented in `.env.shared`                              | —                      | Railway env vars                   |
| `GITHUB_CLIENT_*`           | DevDrip Local OAuth app                                 | no-op test values      | DevDrip OAuth app                  |
| `UPSTASH_REDIS_REST_*`      | unset → in-memory `TestRedis` fallback                  | unset → `TestRedis`    | real Upstash creds                 |
| `DEVDRIP_ALLOW_NEON_IN_DEV` | unset                                                   | —                      | — (guard not active in production) |

### `DISTRO_ENV` — single source of truth for URLs

`packages/shared/src/env-bundle.ts` defines `local | staging | prod` bundles
(apiUrl, webUrl, magicLinkFromEmail). API, CLI, and frontend all call
`resolveEnv()` so a hardcoded URL in one place can't drift away from the rest.

- **API**: reads `DISTRO_ENV` (or falls back to `NODE_ENV`); `env.apiUrl`,
  `env.webUrl`, `env.magicLinkFromEmail` flow through the bundle.
- **CLI**: defaults to `prod`. Override per command with `DISTRO_ENV=local distro init`,
  or persist by setting `apiUrl` in `~/.distro/config.json`. Legacy
  `DISTRO_API_URL` still wins for ad-hoc one-offs.
- **Frontend**: needs both `DISTRO_ENV` (server) and `NEXT_PUBLIC_DISTRO_ENV` (client)
  — Next inlines `NEXT_PUBLIC_*` at build time. Production sets both to `prod`
  on Vercel; local `.env.local` sets both to `local`.

When you add a new environment, edit the bundle in `packages/shared` and rebuild —
no per-package URL changes needed.

### Deliberately testing against Neon locally

If you need to reproduce a prod-only data issue without deploying, uncomment the `DATABASE_URL*` lines in `.env.shared` (or your worktree's `.env`), set `DB_TARGET=neon`, and pass `DEVDRIP_ALLOW_NEON_IN_DEV=1`:

```bash
DB_TARGET=neon DEVDRIP_ALLOW_NEON_IN_DEV=1 pnpm --filter @devdrip/api dev
```

Without `DEVDRIP_ALLOW_NEON_IN_DEV=1`, the API refuses to start with an explicit "switch to local" message. This exists because every dev touching the same Neon DB was the cause of the S2-06 schema-drift incident.

### Shared env file + drift detection

`~/.superset/worktrees/devdrip/.env.shared` is the source of truth copied to `packages/api/.env` on each worktree setup. If you pull new secrets or defaults into the shared file later, refresh existing worktrees:

```bash
bash ~/.superset/worktrees/devdrip/setup-worktree.sh --check-env  # lists drift
bash ~/.superset/worktrees/devdrip/setup-worktree.sh --sync-env   # overwrite (backs up existing as .env.bak.<ts>)
```

## Install

```bash
pnpm install
```

Root build and validation commands depend on Turbo, which is installed through project dependencies.

## Common Commands

From repo root:

```bash
pnpm build
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
```

Package-level examples:

```bash
pnpm --filter frontend dev
pnpm --filter @devdrip/api dev
pnpm --filter @devdrip/dashboard dev
pnpm --filter @devdrip/cli build
```

## Environment Setup

## Frontend

Copy values from `frontend/.env.example`.

Needed for the full waitlist path:

- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `IP_HASH_SALT`

## API

Copy values from `packages/api/.env.example`.

Important toggles:

- `DB_TARGET=local` (default in dev) uses `DATABASE_URL_LOCAL` → Docker Postgres
- `DB_TARGET=neon` uses `DATABASE_URL` → Neon (deployed envs; requires `DEVDRIP_ALLOW_NEON_IN_DEV=1` in dev)

Important runtime vars:

- GitHub OAuth credentials
- `JWT_SECRET`
- `CLIENT_REDIRECT_URL`
- Upstash Redis vars
- `ALLOWED_ORIGINS`

## Dashboard

Copy values from `packages/dashboard/.env.example`.

## Database Work

Useful API package commands:

```bash
pnpm --filter @devdrip/api db:generate
pnpm --filter @devdrip/api db:migrate
pnpm --filter @devdrip/api db:push
pnpm --filter @devdrip/api db:studio
pnpm --filter @devdrip/api db:seed
```

## Admin CLI Smoke Test

With the API running and `ADMIN_SECRET` set (defaults to `test-admin-secret` in the worktree `.env`):

```bash
export DEVDRIP_ADMIN_SECRET=test-admin-secret
export DEVDRIP_API_URL=http://localhost:3001

pnpm --filter @devdrip/cli build

node packages/cli/dist/index.js admin stats
node packages/cli/dist/index.js admin user list
node packages/cli/dist/index.js admin advertiser list
node packages/cli/dist/index.js admin campaign list
node packages/cli/dist/index.js admin payouts list
node packages/cli/dist/index.js admin invite generate --count 3
```

All admin commands read the secret from `DEVDRIP_ADMIN_SECRET` (or `ADMIN_SECRET`) and the base URL from `DEVDRIP_API_URL` (default `http://localhost:3000`).

## Suggested Starting Points

- working on acquisition or early user funnel: start in `frontend`
- working on auth or backend runtime: start in `packages/api`
- working on shared product vocabulary: start in `packages/shared`
- working on local runtime behavior: start in `packages/cli`
- working on dashboard product UI: start in `packages/dashboard`
