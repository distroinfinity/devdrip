# Monorepo Layout

## Workspace Layout

```text
frontend/
packages/
  api/
  cli/
  dashboard/
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
- public site and waitlist flow
- Tailwind-based UI
- Vercel analytics
- direct use of Neon and Resend in the route layer

## `packages/api`

- Express 5 app
- Drizzle schema and migrations
- JWT auth
- GitHub OAuth integration
- Upstash-backed rate limiting
- Pino logging

## `packages/cli`

- Commander CLI
- command tree is defined
- only `lib/device.ts` contains meaningful operational logic today

## `packages/dashboard`

- separate Next.js app
- app shell only

## `packages/shared`

- shared enums such as ad surface, ad source, campaign status
- shared domain interfaces such as `Device`, `User`, `Campaign`, `Impression`
- shared timing and payout constants

## Environment Boundaries

## `frontend/.env.example`

- `NEXT_PUBLIC_SITE_URL`
- `DATABASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `IP_HASH_SALT`

## `packages/api/.env.example`

- local and Neon Postgres URLs
- GitHub OAuth credentials
- JWT secret
- client redirect URL
- Upstash Redis credentials
- `ALLOWED_ORIGINS`
- `DB_TARGET`

## `packages/dashboard/.env.example`

- `NEXT_PUBLIC_API_URL`

## Build and Runtime Notes

- Turbo is required for root-level build, test, and typecheck
- package dependencies are not installed in the explored environment, so root validation was not runnable here
- the repo currently contains two separate Next.js apps: `frontend` and `packages/dashboard`
