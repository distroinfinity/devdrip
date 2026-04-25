# Architecture Overview

## System Shape

DevDrip is currently a monorepo with two user-facing web apps, one backend API, one shared package, and one CLI package.

```mermaid
flowchart LR
  U[User Browser] --> F[frontend]
  F --> W[Waitlist API route]
  W --> N[(Neon Postgres)]
  W --> R1[Resend]

  C[CLI] --> A[packages/api]
  D[Dashboard] --> A

  A --> G[GitHub OAuth]
  A --> P[(Postgres)]
  A --> R2[(Upstash Redis)]

  S[packages/shared] --> A
  S --> C
  S --> D
```

## Package Responsibilities

- `frontend`
  Public landing page, metadata assets, and `/api/waitlist`.
- `packages/api`
  Express app with auth, device registration, health checks, env handling, logging, rate limiting, and Drizzle schema.
- `packages/shared`
  Shared enums, domain types, and product constants.
- `packages/cli`
  Commander-based CLI entrypoint and command registration.
- `packages/dashboard`
  Separate Next.js app with minimal shell.

## Active Flows

### Landing and Waitlist

```mermaid
sequenceDiagram
  participant B as Browser
  participant F as frontend
  participant DB as Neon waitlist table
  participant M as Resend

  B->>F: submit waitlist form
  F->>F: validate email, tools, spend, source
  F->>F: hash IP and apply in-memory rate limit
  F->>DB: insert waitlist row
  F->>DB: compute position
  F->>M: send confirmation email
  F-->>B: success or duplicate response
```

### Auth and Device Registration

```mermaid
sequenceDiagram
  participant U as User / CLI
  participant API as packages/api
  participant GH as GitHub
  participant DB as Postgres
  participant R as Redis

  U->>API: GET /auth/github/redirect
  API-->>U: redirect to GitHub
  U->>GH: authorize app
  GH->>API: GET /auth/github/callback
  API->>GH: exchange code, fetch user
  API->>DB: upsert user, insert refresh token
  API->>R: store one-time exchange code
  API-->>U: redirect with exchange code
  U->>API: POST /auth/exchange
  API->>R: getdel exchange code
  API-->>U: access token + refresh token
  U->>API: POST /devices
  API->>DB: insert or update device
  API-->>U: device payload
```

## Important Boundaries

- waitlist intake lives in `frontend`, not `packages/api`
- waitlist persistence uses raw SQL against Neon, not shared Drizzle schema
- API runtime uses Postgres plus Redis
- CLI and dashboard do not yet implement their intended product flows
- shared types model more of the product than the runtime exposes today

## Runtime Notes

- `packages/api` checks DB and Redis on startup
- DB failure is fatal on startup
- Redis failure is tolerated on startup and in rate limiting paths
- `/health` returns `200` when DB is healthy, even if Redis is degraded
