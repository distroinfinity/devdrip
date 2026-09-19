# Dashboard Current State

The dashboard ships as part of the landing-page Next.js app at `frontend/`. There is no separate `packages/dashboard` anymore — landing + dashboard share one Vercel project, one domain (`devdrip.xyz`), one bundle, one cookie jar.

## URL shape

- `/` — landing page (marketing)
- `/sign-in` — GitHub OAuth entry point
- `/dashboard` — earnings overview (auth-gated)
- `/auth/callback` — one-time exchange-code handoff from the API
- `/auth/refresh` — swaps an expired access cookie using the refresh cookie
- `/auth/sign-out` — clears both cookies, revokes the refresh family on the API

## Auth

GitHub OAuth → API issues a 60-second one-time exchange code → dashboard calls `POST /auth/exchange` → backend returns `{ token, refresh_token }` → route handler writes two httpOnly cookies (`dd_access`, `dd_refresh`; `SameSite=Lax`, `Secure` in prod) → redirect to `/dashboard`.

Middleware (scoped via `matcher: ["/dashboard/:path*", "/sign-in", "/auth/:path*"]`) gates `/dashboard/*`:

- `dd_access` present → pass through
- only `dd_refresh` → redirect to `/auth/refresh?next=<path>`, which rotates tokens and bounces back
- neither → redirect to `/sign-in`

The landing page at `/` is intentionally outside the matcher, so it never takes an auth hop.

## Data fetching

All dashboard reads happen in Server Components via `apiFetchOrRefresh()` in `frontend/lib/api.ts`:

- `GET /me` — surfaced via `getServerUser()` helper in `frontend/lib/auth.ts`
- `GET /me/earnings/summary` — balance, today/week/month/all-time, streak, impressions, clicks, top categories
- `GET /me/earnings/timeseries?days=90` — dense daily buckets (zero-fills gaps)

Each Server Component call reads the access cookie via `next/headers`, adds `Authorization: Bearer`, and on 401 redirects to `/auth/refresh?next=<current>`.

## File layout

```
frontend/
  app/
    sign-in/page.tsx
    dashboard/{layout,page}.tsx
    auth/{callback,refresh,sign-out}/route.ts
  components/
    dashboard/
      app-shell.tsx     ← <AppHeader /> + main + <AppFooter />
      app-header.tsx    ← brand + nav pills + theme toggle + user menu
      app-footer.tsx    ← reused shell on sign-in + dashboard
      brand-mark.tsx    ← logomark + wordmark + v0.1 badge
      earnings-hero.tsx ← big JetBrains Mono balance + streak pill
      earnings-chart.tsx← recharts line, single indigo stroke, custom tooltip
      stat-grid.tsx     ← today/week/month/all-time
      category-bars.tsx ← top 3 categories horizontal bars
      footer-strip.tsx  ← impressions/clicks/updated-at
      empty-state.tsx   ← "no earnings yet — devdrip install ..."
      …
    landing/            ← existing marketing sections (unchanged)
  lib/
    api.ts, auth.ts, cookies.ts, auth-errors.ts, env.ts, format.ts, categories.ts
  middleware.ts         ← dashboard-scoped matcher
```

All design tokens, fonts, theme init, and shared primitives live in `@devdrip/design-system` (workspace package). Landing + dashboard both consume it.

## Deploy

- Vercel project `devdrip` (root `frontend/`, Next.js, turbo-aware build: `cd ../.. && pnpm turbo run build --filter=devdrip...`)
- Custom domain: `devdrip.xyz`
- Preview URLs auto-generated on every push; OAuth only completes on prod because `CLIENT_REDIRECT_URL` on the Railway API is a single value.
- GitHub → Vercel auto-deploy.

## What doesn't exist yet

- Impressions history (`/dashboard/impressions`) — S4-03
- Analytics (`/dashboard/analytics`) — S4-04
- Preferences editor (`/dashboard/preferences`) — S4-05
- Wallet connect (`/dashboard/wallet`) — S4-07
- Payout history (`/dashboard/payouts`) — S4-11
- Live-updating ticker (snapshot-on-load is MVP)
- Preview-branch OAuth (needs a state-param allowlist on the API)

## Engineering takeaway

Treat `frontend/` as one Next app with the dashboard as a route group, not a sibling package. Adding a new dashboard page = add a route under `frontend/app/dashboard/<name>/` and a component under `frontend/components/dashboard/`. No new Vercel projects, no new domains.
