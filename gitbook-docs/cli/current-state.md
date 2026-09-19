# CLI Current State

`packages/cli` is the Distro TV terminal client. Binary: `distro` (alias: `dtv`). Install via curl:

```sh
curl -fsSL https://get.distrotv.xyz/install.sh | sh
```

## Structure

- entrypoint: `src/index.ts`
- command parser: Commander
- package name: `@distrotv/cli`
- binary: `distro` (wrapper at `~/.local/bin/distro`)

## Registered Commands

- `init` — onboarding: anonymous device registration + browser pairing + magic-link sign-in + hook install
- `login` — re-link an existing device to an account (magic-link flow)
- `config` — local config read/write
- `status` — summary of channel mode, daemon health, recent slot activity
- `daemon` — start / stop / status / run
- `sync` — manually flush ledger to `/ingest`
- `demo` — render one slot with `[DEMO]` badge + vanish-timing stats
- `doctor` — 8 probes: auth, device, hooks, backend, daemon, slot cache, tty, disk
- `uninstall` — remove hooks, stop daemon, preserve ledger
- `upgrade` — check GitHub Releases for a newer tarball
- `preferences` — channel mode, quiet hours, tz offset (interactive + `--set`)
- `watchlist` — add / remove / list tickers in the active watchlist
- `hook` — subcommands called by Claude Code settings.json hooks

## `distro init`

Seven-step onboarding:

1. **device registration** — `POST /devices/register` (anonymous bearer); stores `device_secret` + `device.id` in `~/.distro/config.json`.
2. **browser pairing** — `POST /devices/pair` → opens `distrotv.xyz/setup?pair=<code>` in the browser.
3. **magic-link sign-in** — user enters email on `/setup`; clicks link; device is re-pointed to the email-bound user account.
4. **hook install** — merges `PreToolUse`, `Stop`, `UserPromptSubmit` entries into `~/.claude/settings.json`. Idempotent. Symlink at `~/.distro/bin/distro` is refreshed to the current binary path.
5. **channel picker** — choose from `news only / news heavy / balanced / ticker heavy / ticker only`.
6. **watchlist seed** — add tickers interactively.
7. **health check** — 4 parallel probes printed as ✓/✗.

## `distro preferences`

Top-level menu:

- channel mode (5 positions)
- quiet hours (HH:MM start / end; empty start = disabled)
- tz offset (auto-detect via `Intl`, manual fallback)

`--set key=value` for scripting. Atomic write to config + `{"type":"reload-config"}` over daemon socket.

## Config file shape

`~/.distro/config.json` (mode `0600`):

```json
{
  "version": 3,
  "apiUrl": "https://api.distrotv.xyz",
  "auth": {
    "accessToken": "device.<hex>",
    "refreshToken": null,
    "accessTokenExpiresAt": null
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "device": { "id": "uuid" },
  "cli": { "binPath": "/abs/path/to/distro" },
  "preferences": {
    "channelMode": "balanced",
    "quietHoursStart": null,
    "quietHoursEnd": null,
    "tzOffsetMinutes": 0
  }
}
```

`DISTRO_ENV=local` overrides the apiUrl for local dev. `DISTRO_API_URL` still wins for ad-hoc one-offs.

## Library layout

- `src/lib/config.ts` — atomic read/write/delete with mode enforcement.
- `src/lib/api-client.ts` — `apiFetch` (device bearer + magic-link JWT + transparent refresh-on-401). Throws `NotAuthenticatedError` when refresh fails.
- `src/lib/slot-cache.ts` — JSON cache at `~/.distro/slot-cache.json`. Pre-fetches `SlotContent[]` from `/me/content/next` so hooks serve in <200ms.
- `src/lib/ledger.ts` — SQLite ledger at `~/.distro/ledger.db`. See [local-ledger.md](./local-ledger.md).

## Daemon + Hook IPC

See [daemon-and-hooks.md](./daemon-and-hooks.md) for the runtime shape.

## Slot cache

Pre-fetched slots stored on disk at `~/.distro/slot-cache.json` so hooks can serve in <200ms without a network round-trip. Cache version 3; older files are silently dropped on first run after upgrade. See [Slot Content](../architecture/slot-content.md) and [Channel Modes](../architecture/channel-modes.md) for the slot shape.

## `distro doctor`

Eight probes in fixed order, each with a remediation hint on failure:

1. auth valid (`GET /me`)
2. device registered
3. hooks installed in `~/.claude/settings.json` (all three Claude events)
4. backend reachable (`GET /health`)
5. daemon running (heartbeat age < 20s)
6. slot cache populated (≥1 slot, `expiresAt > now`)
7. tty writable
8. disk space for ledger (fail < 10 MB, warn < 100 MB)

Flags: `--json` for scripting. Exit codes: 0 = all pass, 1 = any fail.

The two network probes (`/me`, `/health`) run with a 2.5s budget and retry once at 5s on a transient failure (timeout, network blip, or 5xx) before reporting `✗`; definitive answers (4xx, not-signed-in) skip the retry. The earlier 500ms single-shot budget produced false negatives against a warm prod backend — TLS/DNS on a freshly-spawned process routinely pushed a healthy round-trip past 500ms, so `init`/`doctor` would report sign-in + backend as down while the daemon (10s budget) was fetching slots fine.

## `distro demo`

Fetches one real slot from `/me/content/next`, renders with a `[DEMO]` badge. Vanish latency is measured and printed (`dismiss → vanish: Nms (target <200ms)`). Falls back to bundled fixtures if backend is down.

## `distro upgrade`

Downloads, verifies, and activates the latest `distrotv-cli.tar.gz` from GitHub Releases. The pipeline: download tarball → extract to a staging dir → `npm install` native deps → verify (`node <staged>/dist/index.js --version` must match the release tag AND `daemon self-check` must exit 0) → atomically move into `~/.distrotv/versions/<v>/` and repoint the `~/.distrotv/current` symlink → restart the daemon through `current`. `distro upgrade --force` bypasses the 10-min fetch cache.

## Auto-update

The daemon runs the update check on boot and every ~15 min. When a newer release is found it runs the same download → verify → activate pipeline automatically, then restarts itself.

**Versioned install layout:** `install.sh` extracts each release into `~/.distrotv/versions/<v>/` and keeps `~/.distrotv/current` pointing at the active version. Shims (`~/.local/bin/distro`, `dtv`) and Claude hook entries always resolve through the stable `~/.distrotv/current/dist/index.js` path, so a version swap is invisible to them. A legacy flat `~/.distrotv/dist` install is self-migrated into the versioned layout on first boot (`migrateFlatInstall`).

**Safety / rollback:** activation writes rollback state (`update-state.json`, phase `probation`, `previousVersion`) before the symlink swap. After restart the new daemon runs on probation; once healthy for ~60s it promotes to `stable` and prunes old versions (keeps last 1, semver-aware). If the new build crash-loops (no heartbeat past a ~90s threshold), the Claude hook respawn path performs an fs-only rollback — reverts `current` to the previous version and marks the bad version for a 1-hour backoff — without ever blocking Claude Code (hooks always exit 0). See [daemon-and-hooks.md](./daemon-and-hooks.md#auto-update--rollback).

**Opt-out:** auto-update is on by default. Disable with `DISTRO_NO_AUTOUPDATE=1` (env) or `cli.autoUpdate: false` in `~/.distro/config.json`. When disabled, the daemon falls back to the passive status-line nudge. There is no server-side gate — to halt a bad release, yank or replace the GitHub release asset.

## What is missing

- `distro doctor --fix` auto-remediation (deferred — duplicates `init` paths)
- backend `/me/uninstall` endpoint for retention tracking
