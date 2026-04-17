# Dev Workflow

## Prerequisites

- Node 20+
- pnpm 10+
- Docker (for local Postgres — see below) or a Neon connection string
- GitHub OAuth app credentials for auth flow testing
- Upstash Redis credentials only for production-like rate-limit testing; in development (`NODE_ENV=development` without `UPSTASH_REDIS_REST_URL`) the API falls back to an in-memory store

## Local Postgres via Docker

A ready-to-use image is already provisioned on most dev machines as container `devdrip-postgres`. Start or create it:

```bash
# reuse an existing container
docker start devdrip-postgres

# or create one fresh
docker run -d --name devdrip-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=devdrip \
  -p 5432:5432 \
  postgres:16-alpine
```

Then in `packages/api/.env`:

```bash
DB_TARGET=local
DATABASE_URL_LOCAL=postgresql://postgres:postgres@localhost:5432/devdrip
DATABASE_URL_LOCAL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/devdrip
```

Apply the schema once:

```bash
pnpm --filter @devdrip/api db:push
```

Seed optional demo data:

```bash
pnpm --filter @devdrip/api db:seed
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

- `DB_TARGET=local` uses `DATABASE_URL_LOCAL`
- `DB_TARGET=neon` uses `DATABASE_URL`

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

## Current Validation Status In This Environment

During documentation work, root validation could not be executed because dependencies are not installed in the current workspace snapshot.

Observed result:

- `pnpm test` fails because `turbo` is not available yet
- `pnpm typecheck` fails for the same reason

This is an environment issue, not a documented product behavior issue.

## Suggested Starting Points

- working on acquisition or early user funnel: start in `frontend`
- working on auth or backend runtime: start in `packages/api`
- working on shared product vocabulary: start in `packages/shared`
- working on local runtime behavior: start in `packages/cli`
- working on dashboard product UI: start in `packages/dashboard`
