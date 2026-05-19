# Admin Dashboard

Internal operator surface at a dedicated `admin.<base>` subdomain. Introduced in M7.

## Audience + auth

Single admin pool gated by `ADMIN_EMAILS` (comma-separated env var, lowercased on parse). Bootstrap admin: `manurajput2911@gmail.com`. The `requireAdmin` middleware in `packages/api/src/middleware/admin.ts` chains after `requireAuth` and looks up the authenticated user's email against the allowlist. Returns 503 `admin_disabled` if `ADMIN_EMAILS` is unset, 403 `not_admin` if the user's email isn't in the list.

`requireAuth` populates `res.locals["userId"]` from the JWT (or device-secret) flow; `requireAdmin` reads it to look up the email.

## Hosting

Same Next.js app, separate hostname. `frontend/middleware.ts` inspects `Host`; admin requests rewrite to `/admin/*` paths internally so the file structure under `frontend/app/admin/` matches Next.js conventions while the URL bar shows clean root-relative paths on the admin subdomain (e.g. `admin.distrotv.com/sources` → file `frontend/app/admin/sources/page.tsx`).

`NEXT_PUBLIC_ADMIN_HOSTS` (comma-separated) tells the middleware which hostnames are admin. `COOKIE_DOMAIN=.basehost` scopes session cookies to the parent domain so SSO works across user + admin subdomains. The inverse redirect (user host hitting `/admin/*` → bounce to admin host) is also handled by the middleware.

If `NEXT_PUBLIC_ADMIN_HOSTS` is unset, the middleware is a no-op — admin paths still work at `/admin/*` on the user host as a fallback for local dev.

## Pages

| URL on `admin.host` | File                                     | Surface                                                                                                    |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/`                 | `frontend/app/admin/page.tsx`            | Overview — 3-column counts header + 2×2 grid (system health, signups 7d, mode distribution, recent alerts) |
| `/sources`          | `frontend/app/admin/sources/page.tsx`    | News sources CRUD with status dots and inline edit                                                         |
| `/tickers`          | `frontend/app/admin/tickers/page.tsx`    | Ticker symbol-map CRUD                                                                                     |
| `/users`            | `frontend/app/admin/users/page.tsx`      | Paginated user list (50/page) with substring filter                                                        |
| `/users/:id`        | `frontend/app/admin/users/[id]/page.tsx` | Per-user drill-down (read-only)                                                                            |
| `/metrics`          | `frontend/app/admin/metrics/page.tsx`    | Aggregate charts (recharts)                                                                                |
| `/audit`            | `frontend/app/admin/audit/page.tsx`      | Alert audit log across all users with time-window filter chips                                             |

## Data

- News sources: existing `news_sources` table extended with `enabled BOOLEAN` (admin-managed; distinct from system-managed `healthy`). The news fetcher coordinator skips `enabled = false` rows.
- Ticker symbols: new `ticker_symbol_map` table seeded from the previously hardcoded `symbol-map.ts` (8 crypto + 7 equity rows). The ticker-fetcher reads from this table with a 60s in-process cache; admin write paths invalidate the cache via `invalidateSymbolMapCache()`.

Schema migration: `0019_ticker_symbol_map_and_news_sources_enabled.sql`.

## API endpoints

All under `/admin/*`, gated by `requireAuth` + `requireAdmin` (chained on the router itself):

| Method            | Path                                      | Purpose                                                             |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| GET               | `/admin/overview`                         | Overview bundle (counts, signups, mode distribution, recent alerts) |
| GET               | `/admin/system-health`                    | Worker tick + per-source state with status (green/amber/red)        |
| GET               | `/admin/news-sources`                     | List news sources                                                   |
| POST/PATCH/DELETE | `/admin/news-sources[/:id]`               | CRUD                                                                |
| GET               | `/admin/ticker-symbols`                   | List ticker symbols                                                 |
| POST/PATCH/DELETE | `/admin/ticker-symbols[/:symbol]`         | CRUD                                                                |
| GET               | `/admin/users?page=1&limit=50`            | Paginated user list with per-user counts                            |
| GET               | `/admin/users/:id`                        | Per-user drill-down bundle                                          |
| GET               | `/admin/metrics?days=30`                  | Aggregate metrics for charts                                        |
| GET               | `/admin/alert-events?limit=100&since=...` | Cross-user audit log                                                |
| POST              | `/admin/test-slack-webhook`               | Debug helper                                                        |

## Slack webhook

`packages/api/src/lib/slack.ts::sendSlackAlert(message, opts)`. Fire-and-forget POST to `SLACK_WEBHOOK_URL`. Optional Redis-backed throttle via `opts.dedupe` key (1-hour TTL).

Wired in:

- News fetcher coordinator: fires after 3 consecutive failures per source. Dedupe key: `news-source-<id>`.
- Ticker fetcher coordinator: fires after 3 consecutive failures per provider (Coingecko: full-batch failure; Finnhub: full-tick failure where all symbols fail). Dedupe key: `ticker-provider-<provider>`.
- API boot: single `info` ping at startup (`api booted · sha=<7-char>`).
- Worker boot: same pattern (`worker booted · sha=<7-char>`).

If `SLACK_WEBHOOK_URL` is unset, all sends are no-ops.

## Visual language

Inherits the v5 design language from M6 (sharp 0–2px radii, hairline borders, Space Mono / DM Sans / JetBrains Mono, indigo accent, dot-grid backdrop). Admin extensions:

- Persistent `ADMIN` pill in the header (`bg-[var(--status-negative-surface)]` + `text-[var(--status-negative)]`, font-display 9px caps tracking-wider)
- Higher density: 11px JetBrains Mono primary in tables, 6px row padding
- Status-dot trio (forest / amber / oxblood) for actual system-health signals — no decorative pulse animation; just a 6×6 SVG circle with a glow shadow at the right intensity per state
- Active nav: 2px left-border accent (same as user dashboard)

## Failure modes

| Failure                              | Behavior                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_EMAILS` unset                 | All admin endpoints return 503 `admin_disabled`; admin layout treats it as "not admin" and bounces to user host root |
| User not in allowlist                | 403 `not_admin`; admin layout catches the error and redirects to user-dashboard host root                            |
| `SLACK_WEBHOOK_URL` unset            | Slack lib is a no-op; all other admin features work                                                                  |
| `NEXT_PUBLIC_ADMIN_HOSTS` unset      | Middleware no-ops; admin paths still accessible at `/admin/*` on the user host as a fallback                         |
| Cookie not scoped to parent domain   | Admin must sign in separately on the admin host (acceptable fallback)                                                |
| Concurrent admin edits same source   | Last-write-wins; no optimistic concurrency at v1                                                                     |
| Redis unavailable for Slack throttle | Throttle check logs and continues without dedupe — Slack can fire duplicates briefly until Redis recovers            |

## Deferred to M8+

- User moderation (suspend, ban, quota override)
- Feature flags / kill switches
- Sponsored slot earnings reporting (separate M8 track)
- Admin action audit log (who edited what when)
- 2FA for admin auth
- Server-side user search
- Optimistic concurrency control

## References

- v5 visual language: `architecture/dashboard.md`
- M5 alerts: `architecture/alerts.md`
- News pipeline: `architecture/news-pipeline.md`
- Ticker pipeline: `architecture/ticker-pipeline.md`
