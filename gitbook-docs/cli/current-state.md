# CLI Current State

`packages/cli` defines the command surface for the future DevDrip local experience, but most commands are still placeholders.

## Structure

- entrypoint: `src/index.ts`
- command parser: Commander
- package name: `@devdrip/cli`
- published binary: `devdrip`

## Registered Commands

- `init`
- `auth`
- `config`
- `status`
- `daemon`
- `sync`
- `claim`
- `demo`
- `doctor`
- `uninstall`
- `upgrade`
- `verify`
- `referral`
- `admin`
- `hook`

## Current Behavior

Most commands only print a `TODO` message.

That includes:

- `sync`
- `claim`
- `doctor`
- `uninstall`
- `upgrade`
- `verify`
- `referral`

## `auth` + `status` (S2-06)

`devdrip auth` runs the GitHub OAuth round-trip and persists the session locally. `devdrip status` reads that session and shows the signed-in identity.

### `devdrip auth`

Flow:

1. picks the first free TCP port in `[54321, 54330]` on `127.0.0.1` and starts a one-route HTTP server there.
2. opens the default browser (`open` / `xdg-open` / `cmd start`) to `${DEVDRIP_API_URL}/auth/github/redirect?cli_port=<port>`.
3. waits up to 60 seconds for the browser round-trip. On timeout or SIGINT the server closes and the command exits non-zero.
4. the backend handles GitHub consent, mints a one-time exchange code, and redirects the browser to `http://localhost:<port>/callback?code=<one-time>` (or `?error=<reason>`).
5. `POST /auth/exchange` with the one-time code → `{ token, refresh_token }`.
6. `GET /me` with the bearer token → user profile (`id`, `githubLogin`, `email`, `avatarUrl`).
7. writes `~/.devdrip/config.json` atomically (tmp file + rename) with mode `0600`. Parent directory is created with mode `0700`.

Flags:

- `--logout` — revokes refresh tokens via `POST /auth/logout` and deletes `~/.devdrip/config.json`. No-ops (exit 0) when no config exists.
- `-f, --force` — skip the "already signed in, re-authenticate?" confirmation prompt.

Error handling:

- ports 54321–54330 all in use → exit 1 with a clear message.
- user denies GitHub consent → local server receives `?error=access_denied`, prints `auth cancelled`, exits 1.
- 60-second timeout with no callback → exit 1.
- backend 5xx during exchange → exit 1, no token persisted.

### `devdrip status`

Reads `~/.devdrip/config.json` and calls `GET /me`. If the access token is expired, the CLI's `apiFetch` transparently rotates it via `POST /auth/refresh` and retries. Output:

- no config → `auth: not signed in (run \`devdrip auth\`)`
- healthy → `auth: signed in as @<login>` + email
- refresh-invalid → config is cleared, message prompts re-auth
- api unreachable → falls back to cached identity with an offline indicator

### Config file shape

`~/.devdrip/config.json` (mode `0600`):

```json
{
  "version": 3,
  "apiUrl": "https://devdrip-api-production.up.railway.app",
  "auth": {
    "accessToken": "jwt",
    "refreshToken": "hex",
    "accessTokenExpiresAt": "2026-04-21T12:00:00Z"
  },
  "user": {
    "id": "uuid",
    "githubLogin": "handle",
    "email": "user@example.com",
    "avatarUrl": null
  },
  "device": { "id": "uuid" },
  "cli": { "binPath": "/abs/path/to/devdrip" },
  "preferences": {
    "blockedCategories": [],
    "maxPerHour": 8,
    "maxPerDay": 60,
    "sessionWarmupMs": 600000,
    "quietHoursStart": null,
    "quietHoursEnd": null,
    "nightMode": false,
    "tzOffsetMinutes": 330
  }
}
```

`version` exists for future migrations (`1` and `2` auto-migrate on read to `3`, filling in defaults for any new fields). `apiUrl` is captured at sign-in so subsequent commands don't need `DEVDRIP_API_URL` set. `DEVDRIP_API_URL` still takes precedence when present. Before first sign-in, public CLI requests default to the Railway-hosted production API (`https://devdrip-api-production.up.railway.app`), not localhost. The eventual public hostname `api.devdrip.sh` is reserved but not yet DNS-wired.

`preferences` is owned by the `devdrip config` command (S2-12); see [`config` section](#devdrip-config-s2-12) below. The daemon watches this file and reloads preferences live.

### Library layout

- `src/lib/config.ts` — atomic read/write/delete with mode enforcement. Unknown config versions now fail explicitly instead of silently behaving like a logged-out session.
- `src/lib/auth-flow.ts` — port scanner, one-shot callback server, browser opener.
- `src/lib/api-client.ts` — `apiFetch` (bearer + transparent refresh-on-401) and `apiFetchPublic` (no auth — used for `/auth/exchange` and `/auth/refresh`). Defaults to the production API origin unless overridden by `DEVDRIP_API_URL` or persisted config. Throws `NotAuthenticatedError` when refresh fails; throws `ApiError` on other non-2xx responses.

## devdrip init (S2-07)

`devdrip init` turns a fresh install into a working DevDrip setup. Seven visible steps, two user actions on first run (GitHub sign-in + one category multi-select + enter to dismiss preview ad). The command is safe to re-run: it reconciles device state, refreshes hook wiring, and preserves the original Claude settings backup.

Flow:

1. **auth** — if `~/.devdrip/config.json` is missing, runs the GitHub OAuth flow inline (same as `devdrip auth`).
2. **Claude settings dir prep** — ensures `~/.claude/` exists so first-run hook install works even on a fresh machine.
3. **device registration** — always performs `POST /devices` via the refresh-capable CLI API client, then stores the returned `device.id` in config under `device: { id }`. Re-runs reconcile stale local IDs back to the backend truth.
4. **category picker** — `@clack/prompts` multi-select over the seven `AdCategory` values; all pre-checked. Un-checked categories become `blockedCategories` server-side.
5. **preferences saved** — `PUT /me/preferences` with `{ blockedCategories, tzOffsetMinutes }`. `maxPerHour` / `maxPerDay` / quiet hours stay at DB defaults until the dashboard sync API (S4-06) ships.
6. **hooks installed** — merges `PreToolUse`, `Stop`, `UserPromptSubmit` entries into `~/.claude/settings.json`. First-install backup preserved at `~/.claude/settings.json.devdrip-backup`. Existing entries from other tools (MCP, etc.) are never modified — devdrip appends its own matcher group to each event array. Stored commands quote the CLI path when needed so installs under paths with spaces still work, and init now aborts instead of writing hooks if it cannot resolve the `devdrip` executable path.

   Hook paths resolve through a canonical user-scoped symlink at `~/.devdrip/bin/devdrip` that init installs (or refreshes) on every run, pointing to the `realpath` of the currently running binary. Deleting a worktree no longer orphans the hooks in `~/.claude/settings.json` — re-run `devdrip init` from any working build and the symlink retargets without the hook entries changing. This also makes the basename line up with the parser's `DEVDRIP_BIN_RE`, so idempotent re-runs detect and refresh existing hooks instead of appending duplicates.

7. **ad preview** — invokes `devdrip demo` in-process: one `GET /ads/next` via the real Carbon-primary waterfall, rendered as an ASCII box, dismiss on enter.
8. **health check** — four parallel probes (auth, device, hooks, backend) printed as ✓/✗ lines. The hooks probe requires all three Claude events to be present, not just any one devdrip hook. Exits non-zero if any fail.
9. **summary** — earnings projection with an honest per-ad rate, dashboard pointer, and `devdrip status` hint.

Config schema bumped to v2 with new `device: { id }` and `cli: { binPath }` fields. v1 configs migrate on read.

## devdrip config (S2-12)

`devdrip config` exposes the seven user-tunable ad preferences the daemon honors at runtime. It writes `~/.devdrip/config.json` atomically and asks the daemon (over its Unix socket) to reload immediately; the daemon also watches the file on a 1s poll, so hand-edits are picked up too.

Surface:

- `devdrip config` — interactive wizard (`@clack/prompts` menu + per-field prompts).
- `devdrip config --set maxPerHour=4` — single scripting update. Repeatable: `--set maxPerHour=4 --set nightMode=true`.
- `devdrip config --get nightMode` — print one value.
- `devdrip config --list` — print all preferences as JSON.
- `devdrip config --reset` — restore defaults.

Editable keys and validation:

| Key                 | Type                         | Range / notes                                                            |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `blockedCategories` | comma-separated `AdCategory` | `cloud-infrastructure,developer-tools,databases,…`; `none` = empty       |
| `maxPerHour`        | integer                      | 0–1000                                                                   |
| `maxPerDay`         | integer                      | 0–10 000                                                                 |
| `sessionWarmupMs`   | integer (ms)                 | 0–86 400 000 (up to 24h)                                                 |
| `quietHoursStart`   | integer \| `off`             | 0–23 local hour; `off`/`null` disables                                   |
| `quietHoursEnd`     | integer \| `off`             | 0–23 local hour; wraparound allowed (start=22, end=7)                    |
| `nightMode`         | boolean                      | preset: when `true` and no custom quiet hours set, treats 22→07 as quiet |

Side effects on change:

- **Always:** writes atomically, fires `{"type":"reload-config"}` over the daemon socket.
- **When `blockedCategories` changed:** also `PUT /me/preferences` (best-effort; local save succeeds even if the backend is unreachable). On reload, the daemon invalidates its ad-cache so the next batch respects the new blocklist (server-side filter).
- **When the daemon is not running:** the socket write times out silently (fire-and-forget, matches hook behavior); the file watcher picks up the change on the next daemon start.

Daemon-side enforcement today:

- `quietHoursStart` / `quietHoursEnd` / `nightMode` → orchestrator skips the ad at grace-elapsed when the local hour falls in the quiet window.
- `sessionWarmupMs` → orchestrator gates ads during the warmup window counted from daemon start.
- `maxPerHour` / `maxPerDay` → values persist and reload but enforcement is deferred (needs time-windowed ledger queries; tracked separately).
- `blockedCategories` → filtered server-side at `/ads/batch`; local cache refresh triggered on change.

Notes:

- `tzOffsetMinutes` is refreshed from `Date().getTimezoneOffset()` on every save so users who move timezones don't need to edit manually.
- Interactive mode shows the current JSON in a `note()` block after each edit so you can see a diff before saving.

## devdrip demo (S2-07, partial — S5-04 owns the polished version)

`devdrip demo` fetches one real ad from `GET /ads/next?surface=terminal-tv&deviceId=<id>` and renders it via `renderBox()` (fixed 72-col unicode box, ASCII fallback when not a TTY or `NO_COLOR=1`). Ad headline/body/url text is sanitized before printing so terminal control sequences cannot corrupt the screen. Press enter to dismiss. If the backend returns 204 (no ads queued), it prints a graceful "try again after your next Claude session" message. The `[DEMO]` badge, interactive key practice, and vanish-timing stats remain scoped to S5-04.

## `admin` Subcommands

Fully implemented. Reads `DEVDRIP_ADMIN_SECRET` (falls back to `ADMIN_SECRET`) from the environment and `DEVDRIP_API_URL` (default `http://localhost:3000`). Every list/stats command supports `--json` for scripting with `jq`. Missing secret or non-2xx responses exit with code 1 and a readable error.

| Command                            | Backend call                      | Notes                                                                              |
| ---------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `advertiser create`                | `POST /advertisers`               | flags: `--name --email [--company]`                                                |
| `advertiser list`                  | `GET /advertisers`                | `--limit --json`                                                                   |
| `campaign create`                  | `POST /campaigns`                 | flags: `--advertiser-id --name --budget-total --budget-daily --cpm ...`            |
| `campaign list`                    | `GET /campaigns`                  | filters: `--advertiser-id --status`                                                |
| `campaign pause <id>`              | `PATCH /campaigns/:id/status`     | sends `{ status: "paused" }`                                                       |
| `campaign resume <id>`             | `PATCH /campaigns/:id/status`     | sends `{ status: "active" }`                                                       |
| `creative create`                  | `POST /campaigns/:id/creatives`   | flags: `--campaign-id --headline --format --surface --category --source --cpm ...` |
| `creative list --campaign-id <id>` | `GET /campaigns/:id/creatives`    |                                                                                    |
| `stats`                            | `GET /admin/stats`                | today + lifetime table                                                             |
| `invite generate --count <N>`      | `POST /invites`                   | prints 10-char codes one per line                                                  |
| `user list`                        | `GET /admin/users`                | lifetime earnings, wallet y/n                                                      |
| `payouts list [--status <s>]`      | `GET /admin/payouts`              | filter: pending / processing / confirmed / failed                                  |
| `payouts set-status <id> --status` | `PATCH /admin/payouts/:id/status` | operator override: `confirmed` (needs `--tx-hash`) or `failed`                     |

Shared helpers live in `src/lib/admin-client.ts` (auth + fetch) and `src/lib/table.ts` (cli-table3 wrapper + formatters). New CLI commands that call admin endpoints should reuse these instead of rolling their own fetch.

## The One Implemented Operational Piece

`src/lib/device.ts` contains actual device registration logic.

It does three useful things:

- computes a stable machine ID hash
- infers IDE type as `cursor`, `vscode`, or `terminal`
- POSTs to `/devices` on the backend and returns a shared `Device` payload

Machine ID source by platform:

- macOS: `IOPlatformUUID`
- Linux: `/etc/machine-id`
- Windows: registry `MachineGuid`

Fallback behavior:

- if a stable machine ID cannot be read, the code hashes hostname plus platform

## Local Ledger + Ad Cache (S2-08, S2-09)

Two `src/lib` modules that give the future daemon local state without touching the network on the hook path. Both are pure modules with unit tests; neither depends on the daemon existing.

- `src/lib/ledger.ts` — SQLite ledger at `~/.devdrip/ledger.db`. See [local-ledger.md](./local-ledger.md).
- `src/lib/ad-cache.ts` — JSON cache at `~/.devdrip/ad-cache.json`. See [ad-cache.md](./ad-cache.md).
- `src/lib/ad-cache-fixtures.ts` — demo ads for offline fallback.
- `devdrip status --local` prints unsynced impression count without requiring a valid backend session.

## What Is Missing For A Real CLI

- sync pipeline (`devdrip sync` still stubbed; S3-07)
- payout flow
- doctor checks

## Daemon + Hook IPC (S2-10, S2-11)

Landed. See [daemon-and-hooks.md](./daemon-and-hooks.md) for the runtime shape.

## Engineering Takeaway

`packages/cli` now has working identity, onboarding (`devdrip init`), ad preview (`devdrip demo`), the local ledger + ad cache modules, and the config/api-client/auth-flow helpers that every future command will lean on. New commands that hit the backend should use `apiFetch` from `src/lib/api-client.ts` so they inherit transparent token refresh. The remaining gaps are the sync pipeline (S3-07), payouts, and doctor checks.

## Ad rotation & key capture (S3-01/02/03)

While Claude Code is busy running tools, the daemon rotates ads in the terminal. The user can press:

- `[D]` discover — opens the ad URL in their browser, fires click beacon, returns to idle.
- `[S]` skip — advances to the next cached ad (~500ms gap).
- `[K]` kill — stops all ads for the current Claude session. Cleared when the SessionStart hook fires (user restarts `claude`).
- `[M]` mute 30m — persists `muteUntil` to `~/.devdrip/config.json`, ads resume after that timestamp.

### Gating order (suppression)

1. `sessionWarmupMs` (default 1 min)
2. Quiet hours / night mode
3. `muteUntil` in preferences
4. In-memory `sessionKilled` flag (reset on SessionStart)
5. Per-busy-window cap (`MAX_ADS_PER_CONTINUOUS_SESSION`, default 8)
6. Hourly cap (`maxPerHour`, default 20)
7. Daily cap (`maxPerDay`, default 120)

### Viewable-impression rule

Beacon (`impressionBeaconUrl`) fires only when an ad was on screen for ≥1 second AND vanish reason was not a `skipped` result. This follows the IAB/MRC desktop-display viewability standard. `[D]` discover always fires `clickTrackingUrl`.

### Vanish latency

Every vanish logs `vanish latency ms=<n>` to `~/.devdrip/daemon.log`. p95 under load should remain under 200ms.

## Progress bar + earnings toast (S3-04 / S3-05)

### Progress curve

The progress bar inside the ad box is a simulated-work indicator, not a real completion signal. Orchestrator runs a 500ms tick (`PROGRESS_TICK_MS`) keyed on `shownAt`, feeding a sigmoid `1 / (1 + exp(-8·(x − 0.5)))` where `x = elapsed / displayTimeMs`, scaled to `PROGRESS_CAP = 0.9`. This holds the bar below 100% for the whole impression — the jump to full only happens when Claude actually Stops (or the ad times out). Glyphs are thin-track (`━╸─`) to stay quiet inside the heavy double border; ASCII fallback is `=>-`. A verb prefix (`working`/`thinking`/`shipping`/`cooking`) cycles every 4s, keyed off elapsed time so it's deterministic across ticks — blends with Claude Code's verb-loader feel without copying its vocabulary.

On Stop (`idle-end`), any skip/discover/dismiss, or vanish timeout, the state machine emits a `snapProgressToComplete` effect before `vanishDisplay`. The orchestrator recognizes this as a pause point: it writes the 100% frame immediately, then defers the rest of the cleanup (vanish + record + toast) by `PROGRESS_SNAP_HOLD_MS = 120` so the user actually sees the bar fill before the box clears.

### Earnings toast gating

After a valid completed impression, the bottom pane is replaced for 2 seconds with a one-line toast:

```
  ✓ +$0.0042 earned · today $1.24
```

Gating in `state-machine.ts#endShowing`:

- `result === "completed"` (skipped / interrupted / killed / muted → no toast)
- `durationMs >= VALID_IMPRESSION_FOR_TOAST_MS` (3000) — matches the ticket's "shown >3s" bar
- `ad.cacheSource === "api"` — demo ads never toast
- `ad.cpmRate > 0`

`deltaUsdc = (cpmRate / 1000) * REVENUE_SHARE_DEVELOPER` (0.7), same formula the backend uses at sync. `todayUsdc` comes from `ledger.sumTodayOptimistic(tzOffsetMinutes)` which aggregates `cpm_rate` across today's local day and divides once. Backend remains authoritative at sync — this is display-only.

### cpmRate plumbing

`/ads/batch` now includes `cpm_rate` on each row. `AdPayload.cpmRate` is required in shared types; `ad-cache.ts` propagates it into `CachedAd` and bumps `CACHE_FILE_VERSION` to `2` so pre-upgrade caches drop safely. The ledger row stores it on `record()`, making the "today total" resilient to API downtime between ads.

## devdrip status (S3-11)

`devdrip status` replaces the old auth-only stub with a one-screen summary of earnings, payout state, sync backlog, and daemon health.

Human output (5–6 lines, `<` 8 always):

```
user:     @octocat (dev@example.com)
earnings: $1.24 today · $5.80 week · $23.40 month
streak:   3 days
balance:  $5.80 → needs $4.20 more to claim
unsynced: 2 impressions, 0 clicks
daemon:   running (uptime 1h 14m, pid 49017)
```

Flags:

- `--json` — emit a single JSON object, stable shape, for scripting. Always valid JSON; nothing else on stdout.
- `--local` — skip the backend call; show local ledger + daemon only. Kept for scripts that pre-date the backend earnings path.

Data sources, in order:

1. `readConfig()` for `{ user, auth }`.
2. `readDaemonStatus()` (new shared helper in `lib/daemon/lifecycle.ts`) — also used by `devdrip daemon status` so both commands never drift on what "stale" / "running" means. `HEARTBEAT_STALE_AFTER_MS = 30_000`.
3. `apiFetch<EarningsSummaryResponse>("/me/earnings/summary")` — backend returns today/week/month/all-time/streak/top-categories (see `packages/api/src/services/earnings.service.ts`).
4. On success, the response is written to `~/.devdrip/status.cache.json` (atomic, mode `0600`, capped at 24h TTL via `lib/status-cache.ts`).
5. On `ApiError` or network failure the command loads that cache and sets `offline: true` + `offlineReason: "api 500" | "network"`. Older than 24h → no cached numbers, shows `local today ≈ $X.XX` from `ledger.sumTodayOptimistic()` and `—` for week/month.
6. Payout: `{ eligible, threshold: MIN_PAYOUT_USDC=1.0, shortfall }` derived from `balance`.

JSON schema (stable, document before 1.0):

```json
{
  "user": { "githubLogin": "...", "email": "..." } | null,
  "earnings": { "balance": 5.8, "today": 1.24, "week": 5.8, "month": 23.4, "allTime": 23.4,
                "streakDays": 3, "totalImpressions": 122, "totalClicks": 4,
                "topCategories": [{ "category": "...", "amountUsdc": 1.8 }] } | null,
  "earningsFromCache": false,
  "earningsCacheAgeMs": null,
  "payout": { "eligible": false, "threshold": 1.0, "shortfall": 0 } | null,
  "unsynced": { "impressions": 2, "clicks": 0 },
  "localTodayOptimistic": 1.24,
  "daemon": { "health": "running" | "stale" | "not-running", "pid": 49017, "socketPath": "...",
              "uptimeMs": 4428000, "lastHeartbeatAgeMs": 1400,
              "adsShownThisSession": 12, "hooksReceivedThisSession": 67 },
  "offline": false,
  "offlineReason": null | "network" | "api 500" | "local-only" | "not-signed-in"
}
```

## Frequency caps (S3-12)

Three suppression layers apply before any ad reaches the screen, all in `orchestrator.suppressionReason` / `pickNextAd`:

1. **User/global caps** (from `DevdripPreferences` via `devdrip config`): warmup, quiet-hours / night-mode, muteUntil, `sessionKilled`, `maxPerHour`, `maxPerDay`, `MAX_ADS_PER_CONTINUOUS_SESSION`. Any hit returns a `reason` string and the orchestrator emits a null-ad event — the state machine returns to IDLE / INTER_AD silently. No user-visible error. Defaults remain generous on purpose (see `shared/constants/index.ts` note); users tune down with `devdrip config --set maxPerHour=4`.
2. **Per-campaign daily cap** (new, S3-12): `AdPayload.campaignMaxImpressionsPerDay` is populated from `targeting_rules.maxImpressions` in `ad-selection.service.ts#toAdPayload`, serialized over the wire as `campaign_max_impressions_per_day` in `toAdResponse`, and parsed back onto `CachedAd` by `toCachedAd`. Before displaying, the daemon calls `ledger.countImpressionsByCampaignOnUtcDay(campaignId)` and compares against the cap. If hit, the orchestrator pulls the next cached ad from `adCache.next()` — up to `CAMPAIGN_CAP_RETRIES = 5` attempts — so one exhausted campaign doesn't starve the rotation. Day boundary is **UTC**, deliberately aligned with the backend's `utcDate()` Redis key in `packages/api/src/lib/frequency.ts`; a local-day client boundary was the original plan but would disagree with Redis around midnight for any user east or west of UTC, so both sides share UTC 00:00. User-facing earnings totals (`sumTodayOptimistic`) still use the local day — those are two different semantics with two different helpers in `ledger.ts`.
3. **Backend pre-check** continues to run server-side in `lib/frequency.ts#checkCampaignCap` at ad-fetch time. The client-side cap only matters when the same ad is re-picked from the local cache between sync windows, or when the backend is unreachable.

Log lines to grep in `~/.devdrip/daemon.log` when debugging caps: `ad suppressed`, `campaign-cap hit`, `every candidate hit a campaign cap`, `cache empty`.

## Multi-terminal safety (S3-14)

The daemon now runs **one `Session` per tty path**, keyed in a `Map<string, Session>` inside the orchestrator. Sentinel key `"__no_tty__"` handles piped/CI contexts where no controlling tty is resolvable.

**Per-session state** (each tty is independent):

- `state` (IDLE / GRACE / SHOWING / INTER_AD) and the timers that drive it (`graceTimer`, `vanishTimer`, `interAdTimer`, `progressTimer`)
- `currentDisplay` handle — each tty opens its own fd in `display.ts`; no shared rendering state
- `sessionKilled` — `devdrip kill-session` on tty-A never stops ads on tty-B
- `adsInCurrentBusyWindow`, `sessionStartAt` — warmup and session-cap both reset per Claude Code invocation

**Shared globals** (per-user, not per-tty):

- `preferences` — one config, applies to all sessions
- `hourlyTimestamps`, `dailyTimestamps` — rate limits are per-user; two terminals do **not** double the dev's ad load
- `muteUntil` — persisted to `config.json`; propagates to all sessions via the existing reload path
- `adsShownCount`, `hooksReceivedCount` — daemon-wide heartbeat counters

**Wire routing**: every per-session event type (`idle-end`, `dismiss`, `session-start`, `action`) now carries optional `tty` on the wire. Hook commands (`devdrip hook pre-tool|stop|prompt-submit|session-start`) and the `action` command resolve the invoking tty via `resolveTty()` and include it in the socket payload. The daemon routes on that; if `tty` is missing (old client), it falls back to the single active session — preserves single-terminal behavior for the entire existing test suite without breaking any test.

**Key capture**: `createKeyCapture` became a `Map<ttyPath, ActiveCapture>`. `start(tty)` is idempotent per tty; `stop(tty)` only tears down that tty; `stop()` with no arg (shutdown path) drops them all. Keystrokes flow back to `dispatch` with their originating tty, so a `d` / `s` / `k` / `m` in tty-A affects only tty-A's session.

**Shutdown** iterates every session, clears its timers, dispatches `dismiss` to the ones mid-ad so pending impressions land in the ledger, and stops every key capture before the server closes.

### Known caveat

The full multi-terminal path requires running two real Claude Code windows; the existing single-tty test suite (243 tests) passes unchanged, and `daemon-e2e.test.ts` continues to drive the real daemon end-to-end. Manual verification: open two Claude Code windows, confirm `grep "showing ad" ~/.devdrip/daemon.log` shows distinct `tty=` fields, dismissing one leaves the other running.
