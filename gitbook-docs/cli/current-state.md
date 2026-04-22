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

- `config`
- `daemon start`
- `daemon stop`
- `daemon status`
- `sync`
- `claim`
- `doctor`
- `uninstall`
- `upgrade`
- `verify`
- `referral`
- `hook pre-tool`
- `hook stop`
- `hook prompt-submit`

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
  "version": 2,
  "apiUrl": "https://api.devdrip.sh",
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
  "cli": { "binPath": "/abs/path/to/devdrip" }
}
```

`version` exists for future migrations. `apiUrl` is captured at sign-in so subsequent commands don't need `DEVDRIP_API_URL` set. `DEVDRIP_API_URL` still takes precedence when present. Before first sign-in, public CLI requests default to the production API origin (`https://api.devdrip.sh`), not localhost.

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

- daemon process lifecycle
- sync pipeline (`devdrip sync` still stubbed; ledger exposes `listUnsynced` / `markSynced` for it)
- hook → daemon IPC
- payout flow
- doctor checks

## Engineering Takeaway

`packages/cli` now has working identity, onboarding (`devdrip init`), ad preview (`devdrip demo`), the local ledger + ad cache modules, and the config/api-client/auth-flow helpers that every future command will lean on. New commands that hit the backend should use `apiFetch` from `src/lib/api-client.ts` so they inherit transparent token refresh. The remaining gaps are the daemon process, the hook → daemon IPC, and the sync pipeline.
