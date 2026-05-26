# Observability

PostHog error tracking + session replay across all three Distro TV surfaces: API (Railway), dashboard (Vercel), CLI/daemon (user machines).

## Vendor decision

PostHog was chosen over Sentry. Distro TV already operates a PostHog workspace (separate from any unrelated projects). For <100 users the free tier headroom is far wider: 100k exceptions/mo vs Sentry's 5k; 5k web session replays/mo vs Sentry's 50; unlimited seats. PostHog also ships Issues, web session replay linked to errors, and an event-trail "session trace" in one product.

pino logs + Slack alerts remain the local ground truth and paging layer. PostHog is the aggregation, grouping, and history layer on top.

## Shared contract

`packages/shared/src/telemetry.ts` (`@distrotv/shared/telemetry`) exports:

- `TELEMETRY_EVENTS` — canonical event name constants
- `resolveRelease(pkgVersion?)` — picks `RAILWAY_GIT_COMMIT_SHA` / `VERCEL_GIT_COMMIT_SHA` on infra surfaces, falls back to package version (used by the CLI)
- `isTelemetryDisabledByEnv()` — checks the `DISTRO_TELEMETRY=0` kill-switch
- `scrubString(s)` — strips path-shaped and token-shaped substrings (gh*, sk-*, JWTs)
- `scrubError(err)` — wraps `scrubString` over name/message/stack

The module is pure — no SDK import, no network call. Each runtime owns its own PostHog client.

## Per-surface setup

### API (Railway)

Package: `posthog-node`  
Client: `packages/api/src/lib/telemetry.ts`

`captureApiException` is wired into:

- the error handler's **unknown-error branch** (known 4xx/`ApiError` instances are not forwarded — they are not bugs)
- the `unhandledRejection` and `uncaughtException` process handlers in `index.ts` and `worker.ts`

On SIGTERM/SIGINT the shutdown sequence calls a bounded `flushTelemetry()` before the process exits.

`distinct_id` = the authenticated `userId` when available, otherwise `api:system`.

### Dashboard (Vercel)

Package: `posthog-js`  
Files: `frontend/components/posthog-provider.tsx`, `frontend/app/global-error.tsx`

Configuration choices:

- `capture_exceptions: true` — exception autocapture enabled
- session replay active with `maskAllInputs: true` and `maskTextSelector: "*"` — all inputs and readable text are masked before leaving the browser
- `capture_pageview: false` — Vercel Analytics still owns pageview counting; PostHog does not double-count

`global-error.tsx` is a Next.js error boundary that forwards React render errors into PostHog.

### CLI + daemon

Package: `posthog-node`  
Client: `packages/cli/src/lib/telemetry.ts`

The PostHog ingest key and host are **baked at build time** via tsup `define` (`POSTHOG_CLI_KEY` / `POSTHOG_CLI_HOST`). The binary ships with them; no runtime env var is needed.

**Daemon** (long-lived process):

- owns the PostHog client instance
- captures `uncaughtException` and `unhandledRejection` — logs the error and captures it, but **stays alive**; the daemon must never crash the host terminal
- captures all `log.error` call-sites
- flushes on graceful shutdown

**Interactive commands** (`distro init`, `distro news`, etc.):

- call `reportError()` to capture
- then do a bounded (~1.5 s) flush-on-exit before the process terminates

**Hooks** (`distro hook preToolUse`, `distro hook stop`, etc.) **carry no telemetry**. They send one UDS message to the daemon and exit 0. Adding a flush here would violate the <200 ms slot-vanish budget. Any fault on the daemon side is captured by the daemon.

`distinct_id` = anonymous `device.id` before auth; upgraded to `user.id` once the device is registered.

## Consent (CLI only — opt-out)

Telemetry is on by default. Resolution order (first wins):

1. `DISTRO_TELEMETRY=0` environment variable — hard kill-switch
2. `telemetry.enabled` field in `~/.distro/config.json`
3. default on

User-facing controls:

- `distro config telemetry on|off|status`
- one-time notice shown after `distro init`
- `distro doctor` includes a telemetry status probe

API and dashboard telemetry is the project's own infra. No per-user consent is needed; both simply no-op when the key env var is absent.

## Data contract & privacy

**Allow-list — only these fields leave a machine:**

- error name, message, stack (run through `scrubString`)
- runtime context: OS, arch, Node version, CLI version
- route, method, HTTP status (API)
- URL path, browser UA (dashboard)
- `distinct_id` and `release`
- CLI event-trail breadcrumbs: coarse event names and outcomes only

**Hard exclusions — default-deny:**

- Claude prompts, code, file contents, tool inputs/outputs
- news/ticker content, watchlist symbols, reading list, opened URLs
- env vars, secrets, tokens
- file paths outside the distrotv package tree
- full `process.argv`

`scrubString` strips path-shaped substrings and token-shaped values (`gh*`, `sk-*`, JWT patterns). Web session replay masks all inputs and text at the SDK level before transmission.

## Release tagging

| surface   | `release` value                       |
| --------- | ------------------------------------- |
| API       | `RAILWAY_GIT_COMMIT_SHA`              |
| dashboard | `VERCEL_GIT_COMMIT_SHA`               |
| CLI       | package `version` from `package.json` |

Issues in PostHog group by release, so regressions are pinnable to a specific deploy or CLI build.

## Source maps

**Not yet wired — deferred.** Errors arrive and are grouped correctly, but stack frames are minified. Planned approach: `@posthog/cli` (`sourcemap inject` + `upload`) in the API/dashboard deploy workflow and the CLI release workflow (`release-cli.yml`), gated on a `POSTHOG_CLI_TOKEN` CI secret. Until that is wired, minified frames are the status quo.

## Environment variables

| surface            | variable                   | notes                                                 |
| ------------------ | -------------------------- | ----------------------------------------------------- |
| API (Railway)      | `POSTHOG_KEY`              | server-side ingest key                                |
| API (Railway)      | `POSTHOG_HOST`             | defaults to `https://us.i.posthog.com`                |
| dashboard (Vercel) | `NEXT_PUBLIC_POSTHOG_KEY`  | inlined at build; required for client SDK             |
| dashboard (Vercel) | `NEXT_PUBLIC_POSTHOG_HOST` | inlined at build                                      |
| CLI build-time     | `POSTHOG_CLI_KEY`          | passed to tsup `define`; baked into the binary        |
| CLI build-time     | `POSTHOG_CLI_HOST`         | same — baked at release, not read from env at runtime |
| CLI runtime        | `DISTRO_TELEMETRY`         | set to `0` to disable; checked before any capture     |

All runtime code paths no-op when their key is absent or empty.

## Status & open items

**Implemented:**

- shared telemetry contract (`packages/shared/src/telemetry.ts`)
- API capture — unknown errors + process-level handlers + shutdown flush
- dashboard capture — exception autocapture + session replay + global error boundary
- CLI/daemon capture — daemon ownership, hooks excluded, interactive command flush
- CLI consent — env kill-switch, config field, `distro config telemetry`, `distro doctor` probe, post-init notice

**Pending (requires the PostHog project key/host + a personal API token):**

- set `POSTHOG_KEY` / `POSTHOG_HOST` on the Railway API service
- set `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` on Vercel
- bake `POSTHOG_CLI_KEY` / `POSTHOG_CLI_HOST` into `release-cli.yml` via repository secrets
- enable session replay in PostHog project settings
- wire source-map upload via `@posthog/cli` in deploy + release workflows
- end-to-end verification: trigger a test error on each surface and confirm it appears in PostHog Issues
