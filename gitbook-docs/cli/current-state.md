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

- `init`
- `config`
- `daemon start`
- `daemon stop`
- `daemon status`
- `sync`
- `claim`
- `demo`
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
  "version": 1,
  "apiUrl": "https://api.devdrip.sh",
  "auth": {
    "accessToken": "jwt",
    "refreshToken": "hex",
    "accessTokenExpiresAt": "2026-04-20T15:24:00.000Z"
  },
  "user": {
    "id": "uuid",
    "githubLogin": "manu",
    "email": "manu@example.com",
    "avatarUrl": "https://avatars.githubusercontent.com/u/123"
  }
}
```

`version` exists for future migrations. `apiUrl` is captured at sign-in so subsequent commands don't need `DEVDRIP_API_URL` set. `DEVDRIP_API_URL` still takes precedence when present.

### Library layout

- `src/lib/config.ts` — atomic read/write/delete with mode enforcement.
- `src/lib/auth-flow.ts` — port scanner, one-shot callback server, browser opener.
- `src/lib/api-client.ts` — `apiFetch` (bearer + transparent refresh-on-401) and `apiFetchPublic` (no auth — used for `/auth/exchange` and `/auth/refresh`). Throws `NotAuthenticatedError` when refresh fails; throws `ApiError` on other non-2xx responses.

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

## Current Intent Visible In Code

`devdrip init` is still a placeholder but owns device registration — `registerDevice()` is called there, not in `auth`. This keeps the auth command focused on identity and lets repeat-install flows re-run `init` without re-authenticating.

## What Is Missing For A Real CLI

- daemon process lifecycle
- hook handling
- local ledger
- ad cache
- renderer
- sync pipeline
- payout flow
- doctor checks
- `devdrip init` wiring (device registration after auth)

## Engineering Takeaway

`packages/cli` now has working identity plus the config/api-client/auth-flow helpers that every future command will lean on. New commands that hit the backend should use `apiFetch` from `src/lib/api-client.ts` so they inherit transparent token refresh. The remaining gaps are local runtime pieces — daemon, hooks, ledger, renderer.
