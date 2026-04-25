# Dev Workflow

## Prerequisites

- Node 20+
- pnpm 10+
- local Postgres if using `DB_TARGET=local`
- Upstash Redis credentials for normal API rate-limit behavior
- GitHub OAuth app credentials for auth flow testing

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
