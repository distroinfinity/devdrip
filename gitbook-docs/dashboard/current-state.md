# Dashboard Current State

The dashboard ships as part of the landing-page Next.js app at `frontend/`. There is no separate `packages/dashboard` for product surfaces — landing + dashboard share one Vercel project, one domain (`distrotv.xyz`), one bundle, one cookie jar.

## URL shape

- `/` — landing page (marketing + install CTA)
- `/sign-in` — GitHub OAuth entry point (single "Continue with GitHub" button)
- `/setup` — CLI ↔ browser pairing landing (single GitHub button; pair code stashed in cookie)
- `/auth/github/start` — generates state nonce + 302s to github.com OAuth
- `/auth/github/callback` — verifies state, calls API s2s, sets session cookie
- `/dashboard` — activity overview (auth-gated)
- `/dashboard/account` — email, user/device IDs, sign-out
- `/dashboard/preferences` — channel mode, quiet hours, watchlist config
- `/dashboard/reading` — saved stories
- `/chart/:symbol` — public ticker chart (no auth required)

## Auth

`distro init` → CLI calls `POST /devices/pair-init` → opens browser at `/setup?pair=<code>` → user clicks "Continue with GitHub" → `/auth/github/start` → github.com OAuth → `/auth/github/callback` → API `POST /auth/github/complete` (s2s) upserts user, creates device, marks pair ready → session JWT in HTTP-only cookie `distrotv_session` (7-day TTL) → redirect to `/setup/channels`. CLI long-polls `/devices/pair-poll` and receives the device token.

See [architecture/auth.md](../architecture/auth.md) for the full flow + state CSRF model.

Middleware (scoped via `matcher: ["/dashboard/:path*"]`) gates `/dashboard/*`:

- `distrotv_session` present + valid → pass through
- missing or expired → redirect to `/sign-in`

## Data fetching

Dashboard reads happen in Server Components via `apiFetchOrRefresh()`:

- `GET /me` — user identity
- `GET /me/preferences` — channel mode, quiet hours, tz offset
- `GET /me/recent-news?limit=25` — news tab
- `GET /me/watchlist/sparklines?windowSec=86400` — watchlist tab
- `GET /me/alerts/events?limit=25` — alerts tab
- `GET /me/activity-summary?windowSec=86400` — all-activity tab
- `GET /me/devices/:id/now` — terminal mirror (1Hz poll)

## File layout

```
frontend/
  app/
    sign-in/page.tsx
    setup/page.tsx
    dashboard/{layout,page}.tsx
    dashboard/account/page.tsx
    dashboard/preferences/page.tsx
    dashboard/reading/page.tsx
    chart/[symbol]/page.tsx
  components/
    dashboard/
      live-bar.tsx
      activity-tape.tsx
      terminal-mirror.tsx
      tab-bar.tsx
      news-tab.tsx
      watchlist-tab.tsx
      alerts-tab.tsx
      all-tab.tsx
      sidebar/config-readout.tsx
      mode-pill.tsx
      ...
    landing/        ← marketing sections
  lib/
    api.ts, session.ts, cookies.ts, env.ts, format.ts
  middleware.ts     ← dashboard-scoped matcher
```

## Deploy

- Vercel project (root `frontend/`, Next.js, turbo-aware build)
- Custom domain: `distrotv.xyz`
- Preview URLs auto-generated on every push
- GitHub → Vercel auto-deploy via GitHub Actions

## Engineering takeaway

Treat `frontend/` as one Next app with the dashboard as a route group. Adding a new dashboard page = add a route under `frontend/app/dashboard/<name>/` and a component under `frontend/components/dashboard/`. No new Vercel projects, no new domains.
