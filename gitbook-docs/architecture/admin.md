# Admin Dashboard

Internal operator surface. Introduced in M7. **In prod it runs path-based at `distrotv.xyz/admin/*`** — the `admin.<base>` subdomain is not set up (no DNS, `NEXT_PUBLIC_ADMIN_HOSTS` unset). Subdomain mode remains a dormant, optional path (see Hosting).

## Audience + auth

Single admin pool gated by `ADMIN_EMAILS` (comma-separated env var, lowercased on parse). Bootstrap admin: `manurajput2911@gmail.com`. The `requireAdmin` middleware in `packages/api/src/middleware/admin.ts` chains after `requireAuth` and looks up the authenticated user's email against the allowlist. Returns 503 `admin_disabled` if `ADMIN_EMAILS` is unset, 403 `not_admin` if the user's email isn't in the list.

`requireAuth` populates `res.locals["userId"]` from the JWT (or device-secret) flow; `requireAdmin` reads it to look up the email.

## Hosting

**Current (prod + local): path-based.** The admin lives at `/admin/*` on the main host. All admin nav links use the `/admin/*` prefix (`components/admin/admin-shell.tsx`); `app/admin/pathname-shell.tsx` passes the full pathname through so active-state matching works. No subdomain, no extra DNS or env.

**Optional subdomain mode (dormant).** `frontend/middleware.ts` inspects `Host`; if `NEXT_PUBLIC_ADMIN_HOSTS` (comma-separated) names the request host, clean root-relative paths rewrite to `/admin/*` (e.g. `admin.distrotv.xyz/sources` → `frontend/app/admin/sources/page.tsx`), and the inverse redirect bounces user-host `/admin/*` to the admin host. Standing this up requires the DNS CNAME + Vercel domain + `NEXT_PUBLIC_ADMIN_HOSTS` + `COOKIE_DOMAIN=.distrotv.xyz` (SSO across hosts) + appending the admin host to `ALLOWED_ORIGINS`. With `NEXT_PUBLIC_ADMIN_HOSTS` unset the middleware is a no-op and the path-based behavior above applies. (Note: the nav links are `/admin/*`-prefixed, so enabling the subdomain would show `admin.host/admin/*` rather than clean URLs unless the links are revisited.)

## Pages

| URL                | File                                     | Surface                                                                                                                                  |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`           | `frontend/app/admin/page.tsx`            | Overview — 3-column counts header + card grid (system health, signups 7d, mode distribution, recent alerts, os, ide/terminal, languages) |
| `/admin/sources`   | `frontend/app/admin/sources/page.tsx`    | News sources CRUD with status dots and inline edit                                                                                       |
| `/admin/users`     | `frontend/app/admin/users/page.tsx`      | Paginated user list (50/page) with substring filter                                                                                      |
| `/admin/users/:id` | `frontend/app/admin/users/[id]/page.tsx` | Per-user drill-down (read-only)                                                                                                          |
| `/admin/metrics`   | `frontend/app/admin/metrics/page.tsx`    | Aggregate charts (recharts)                                                                                                              |
| `/admin/audit`     | `frontend/app/admin/audit/page.tsx`      | Alert audit log across all users with time-window filter chips                                                                           |

## Data

- News sources: existing `news_sources` table extended with `enabled BOOLEAN` (admin-managed; distinct from system-managed `healthy`). The news fetcher coordinator skips `enabled = false` rows.
- ~~Ticker symbols: `ticker_symbol_map` table + admin CRUD~~ — **deprecated.** Symbol lookup is handled directly by the provider (Yahoo) per spec §12; there is no internal map to administer. The `/admin/ticker-symbols` API routes and the admin **tickers** tab were removed, and `/admin/system-health` no longer reads `ticker_symbol_map` (it previously derived a per-provider `enabledSymbolCount` from it). Ticker _provider_ health (finnhub / coingecko) is still surfaced read-only on the overview system-health card — now just a status dot + last-quote time (sourced from `ticker_quotes`), no symbol count.

Schema migration: `0019_ticker_symbol_map_and_news_sources_enabled.sql` (the `enabled` column on `news_sources` is still in use; the `ticker_symbol_map` table it also created is now fully orphaned — nothing reads it).

## Audience signals collected

What the admin surface can report on, for growth + audience understanding:

- **Identity** (`users`): github id / login / email / avatar, signup time. `repos_count` + `primary_language` are populated at GitHub OAuth (`exchangeCodeForProfile`): `public_repos` from `/user`, top language tallied from `/users/{login}/repos` (best-effort, null on failure — never blocks sign-in). Existing users backfill on their next sign-in.
- **Devices** (`devices`): `os`, `ide_type`, `device_name` (hostname), and `cli_version` (added migration `0022`). These are reported by the daemon on startup via `POST /devices`, which updates the row **by authenticated device id** (the pairing-time row carries a placeholder `machine_id_hash`, so the old `(user_id, machine_id_hash)` upsert never matched and left every device `os='unknown'`). Requires CLI ≥ 0.2.4; older clients keep working and simply report nothing here.
- **Geography**: timezone offset only (`preferences.tz_offset_minutes`). Country is **intentionally not collected**.
- **Usage**: slot impressions (kind, source, dwell, result, link-opened, saved), save rate, news CTR by source, channel-mode split, watchlists, alert fires.

Surfaced in the UI as overview breakdown cards (os / ide / languages) and per-user columns (`lang`, `repos`, `os`) in the user list; `getOverview` adds `osDistribution` / `ideDistribution` / `languageDistribution`, and `listUsers` adds `reposCount` / `primaryLanguage` / `primaryOs` / `cliVersion`.

## API endpoints

All under `/admin/*`, gated by `requireAuth` + `requireAdmin` (chained on the router itself):

| Method            | Path                                      | Purpose                                                             |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| GET               | `/admin/overview`                         | Overview bundle (counts, signups, mode distribution, recent alerts) |
| GET               | `/admin/system-health`                    | Worker tick + per-source state with status (green/amber/red)        |
| GET               | `/admin/news-sources`                     | List news sources                                                   |
| POST/PATCH/DELETE | `/admin/news-sources[/:id]`               | CRUD                                                                |
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
