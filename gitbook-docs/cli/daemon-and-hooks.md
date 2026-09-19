# Daemon + Hook IPC

Fills the last structural gap in the CLI: PreToolUse → 3s grace → ad on screen → impression in the ledger. Implementation of S2-10 (Daemon process) and S2-11 (Hook commands).

## Process model

- **`distro daemon start`** — verifies config, probes for a live socket, spawns `distro daemon run` detached (`stdio: ignore → daemon.log`, `unref()`). Idempotent: running twice from the same user prints `daemon already running (pid N)` and exits 0.
- **`distro daemon run`** — foreground loop. Acquires PID-file singleton at `~/.distro/daemon.lock`, binds unix socket, starts the heartbeat timer, loads config + ledger + ad-cache, enters the event loop.
- **`distro daemon stop`** — sends a `{"type":"kill"}` JSON message over the socket. Falls back to SIGTERM, then SIGKILL.
- **`distro daemon status`** — reads `~/.distro/daemon.heartbeat`. No socket round-trip.

## Runtime files (`~/.distro/`, mode 0700)

| File               | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `daemon.sock`      | unix socket (mode 0600)                                |
| `daemon.lock`      | PID-file singleton (mode 0600)                         |
| `daemon.heartbeat` | JSON, written every 10s, atomic tmp+rename (mode 0600) |
| `daemon.log`       | append-only plaintext (mode 0600, no rotation for MVP) |

macOS long-username fallback: if `sun_path` (104 bytes) would overflow, the daemon binds `/tmp/distro-<uid>.sock` instead. The chosen path is always recorded in `daemon.heartbeat.socketPath` so `distro daemon stop` doesn't need to re-derive it.

## Wire protocol

Newline-delimited JSON, hook → daemon, fire-and-forget:

```
{"type":"session-start"}
{"type":"idle-start","tty":"/dev/ttys003"}
{"type":"idle-end"}
```

Plus one control event from `distro daemon stop`:

```
{"type":"kill"}
```

Key-capture (S3-03) emits `skip | kill | mute | discover | dismiss` from the daemon's raw-tty stdin reader, not from a hook. Unknown event types are logged and dropped.

## Hook subcommand ↔ wire event mapping

The ticket body uses `idle-start` as both the subcommand and the event. The code splits them:

| Claude hook event | CLI subcommand              | Wire event      |
| ----------------- | --------------------------- | --------------- |
| SessionStart      | `distro hook session-start` | `session-start` |
| UserPromptSubmit  | `distro hook prompt-submit` | `idle-start`    |
| PreToolUse        | `distro hook pre-tool`      | `idle-start`    |
| Stop              | `distro hook stop`          | `idle-end`      |

`UserPromptSubmit` and `PreToolUse` both send `idle-start` so the rotation begins the moment the developer hands control to Claude — including pure thinking time before the first tool call. `idle-start` is idempotent in `GRACE` and `SHOWING`, so the duplicate from a later `PreToolUse` is a no-op.

## State machine

Three states: `IDLE → GRACE → SHOWING`. Pure reducer in `lib/daemon/state-machine.ts`. Every row of the transition table has a unit test. See [the spec](../../docs/superpowers/specs/2026-04-22-cli-daemon-and-hooks-design.md) for the full table.

Timer behavior worth remembering:

- Grace timer is `GRACE_PERIOD_MS` (1.5s after the rotation-hardening pass); **first edge wins** — repeated `idle-start` events inside the window don't restart it.
- Vanish timer is `min(ad.displayTimeMs, MAX_AD_DURATION_MS)` (caps at 8s).
- `Stop` during GRACE cancels the grace timer (no ad shows).
- `Stop` during SHOWING records `result = interrupted`.
- `UserPromptSubmit` during SHOWING is a no-op — the ad continues to its natural end (vanish timer or `Stop`), since the developer is still idle while Claude works the queued prompt. Key-press `dismiss` is the only event that ends a SHOWING ad early; impression result is `completed` if visible ≥ 1s, else `skipped`.

## Hook fast path

Each hook subcommand:

- Opens the socket, writes one JSON line, closes. `socket.setTimeout(50)` caps the wall time.
- Reads no config. Imports no heavy modules (`api-client`, `ledger`, `ad-cache`, etc. are never touched on the fast path).
- Explicit `process.exit(0)` on every path. If the daemon isn't running, the connect fails, the promise resolves, and the hook exits 0 in under ~100ms.

tty resolution:

- **Linux:** open `/dev/tty`, read `/proc/self/fd/<n>`.
- **macOS:** `ps -p $$ -o tty=` via `execSync`. `tty(1)` doesn't work because Claude Code pipes stdin.

If resolution fails, the hook sends `tty: null`. The daemon enters SHOWING with no tty, `displayAd` fails cleanly, a synthesized `dismiss` returns state to IDLE. No ad, no impression.

## Impression recording

On exit from SHOWING the state machine emits a `recordImpression` effect carrying a full `LocalImpression` row (`id = randomUUID()`, `result`, `durationMs`, etc.). The orchestrator's handler:

- Skips the ledger write entirely if `impression.source === "demo"` (matches the rule in [ad-cache.md](./ad-cache.md)).
- Catches ledger write errors and warns to `daemon.log`.

## Renderer (S3-01, shipped)

`renderBox()` produces a width-adaptive Unicode box with:

- **Header**: `DISTRO TV` + slot source label on the left. Right segment dropped when width is tight.
- **Body**: word-wrapped headline + body, sanitized for ANSI escapes and control characters before printing so ad copy can't corrupt the screen.
- **URL**: emitted on its own line, unwrapped, outside the box (terminal emulators autodetect the link).
- **Action footer**: `[D]iscover [S]kip [K]ill [M]ute` — the bindings honored by the key-capture reader (S3-03).
- **Progress bar**: filled cells proportional to elapsed display time.

Width clamps at `[40, 120]` columns; ASCII fallback (`+` / `|`) kicks in when the tty is non-color or `NO_COLOR=1` is set.

## Key capture (S3-03, shipped)

While SHOWING, the daemon opens the tty in raw mode (`/dev/<ttyN>`) via `tty.ReadStream` and listens for keystrokes. Mapping (`packages/cli/src/lib/daemon/input.ts`):

| Key                       | Action   | State machine event                                         |
| ------------------------- | -------- | ----------------------------------------------------------- |
| `d` / `D`                 | discover | opens advertiser URL; impression = `completed`; rotates     |
| `s` / `S`                 | skip     | impression = `skipped` (or `completed` if ≥ 1s); rotates    |
| `k` / `K`                 | kill     | dismisses + sets `sessionKilled` until next `session-start` |
| `m` / `M`                 | mute     | dismisses + writes `muteUntil = now + MUTE_DURATION_MS`     |
| `Enter` / `Space` / `Esc` | dismiss  | impression = `completed` if ≥ 1s, else `skipped`            |

`mute` and `kill` are also honored during the GRACE window (the previous ad's footer was visible up to ~1.5s ago, so a key press here is intentional).

Multi-byte chunks starting with `0x1b` (ESC) are treated as terminal control sequences (focus-in/out, arrow keys) and dropped — never our keys. A lone `0x1b` is the user pressing Escape.

CLI fallbacks (`distro skip|mute|kill-session|discover`) dispatch the same wire actions for users whose keystrokes lose the tty race with Claude.

## Anchor strategy (real-session hardening)

Earlier MVP rendered at the cursor and vanished via `\x1b[<n>A\x1b[0J`. That broke the moment Claude Code redrew its TUI between show and vanish — ad fragments interleaved with Claude's box-drawing.

`packages/cli/src/lib/daemon/display.ts` now uses **DECSTBM** (Set Top and Bottom Margins, `\x1b[1;<scrollBottom>r`) to carve the screen into two regions:

- Upper region (rows 1..scrollBottom): Claude's scroll buffer.
- Lower region (scrollBottom+1..rows): the ad pane. Cleared with `\x1b[0J` after `\x1b7` cursor-save and re-anchored on every render with `\x1b8` cursor-restore so Claude's prompt position survives.

On terminal resize, the daemon proactively dismisses the current ad (the next rotation re-anchors with fresh row counts).

## Slot frequency (defaults)

Defaults are permissive; users tune with `distro preferences`:

| Constant                | Value    |
| ----------------------- | -------- |
| `MAX_SLOTS_PER_HOUR`    | `9_999`  |
| `MAX_SLOTS_PER_DAY`     | `99_999` |
| `MAX_SLOTS_PER_SESSION` | `9_999`  |
| `SESSION_WARMUP_MS`     | `3_000`  |
| `INTER_SLOT_GAP_MS`     | `500`    |

Quiet hours remain available as an opt-in suppression window.

## Known limitations (MVP)

- **Last-writer-wins tty.** A user running Claude in two terminals will only see ads in whichever one last sent `idle-start`. Tracked; supporting concurrent ttys requires a `ttyPath → state` map.
- **DECSTBM only.** If the host TUI switches to the alternate screen buffer (`\x1b[?1049h`), the scroll region is discarded and the ad anchor is lost. Modern Claude Code stays on the primary screen during tool calls, so this is fine in practice.
- **Raw mode persists across stop.** `setRawMode(false)` is deliberately NOT called in `input.ts:stop()` because Claude Code owns its REPL's raw-mode setting and toggling it broke Claude's stdin. SIGKILL recovery still requires `reset` if the terminal is left in raw mode.
- **No hook auto-restart.** A stale daemon means hooks silently exit 0. `distro daemon start` restarts it. Auto-restart belongs to `distro doctor`.

## Sync loop (S3-07, shipped)

`packages/cli/src/lib/daemon/sync.ts` exposes:

```ts
createSyncLoop({ ledger, apiClient, log, intervalMs = 5 * 60_000 })
  → { start(), stop(), forceSync(): Promise<SyncResult> }
```

Behavior:

- `setInterval`, `unref`'d — does not prevent daemon exit.
- **Skip-if-in-flight**: overlapping ticks don't stack; a running cycle blocks the next tick.
- **Eager first sync**: on daemon boot, one sync runs immediately to drain impressions accumulated while offline.
- **Exponential backoff on failures**: 5m → 10m → 20m, capped. Resets to normal cadence on any successful cycle. Triggered by top-level network errors or 5xx; per-item errors don't trigger backoff.
- Batch caps per cycle: 250 impressions + 250 clicks (under the backend 500-item combined cap).

**Per-item classification:**

| Error code                          | Classification                 | Action                                             |
| ----------------------------------- | ------------------------------ | -------------------------------------------------- |
| `invalid_or_expired_delivery_token` | terminal (impression + click)  | tombstone (`synced_at = -1`)                       |
| `delivery_token_too_old`            | terminal (impression + click)  | tombstone                                          |
| `delivery_not_owned`                | terminal (impression + click)  | tombstone                                          |
| `impression_already_recorded`       | terminal (impression)          | tombstone                                          |
| `click_already_recorded`            | terminal (click)               | tombstone                                          |
| `campaign_budget_exhausted`         | transient                      | leave for next cycle                               |
| `rate_limit_exceeded`               | transient                      | leave + backoff                                    |
| `too_many_items`                    | transient                      | leave + backoff                                    |
| `internal_error`                    | transient                      | leave + backoff                                    |
| `impression_not_synced`             | transient → terminal after 24h | leave until click.created_at + 24h, then tombstone |

**`distro sync --force`:** standalone CLI path. Opens its own ledger handle and api-client, runs one cycle, prints `synced N impressions, M clicks (K errors)`. Does not go through the daemon socket — works even if the daemon is down. Exits non-zero only on catastrophic failure.

## Key capture and click recording

When the user presses `D` (discover), `orchestrator.ts` `openDiscover` writes a click to the local ledger before opening the advertiser URL:

```ts
deps.ledger.recordClick({ id: uuid(), deliveryToken: imp.deliveryToken, createdAt: now() })
```

The click is queued alongside its parent impression and synced in the next cycle.

## Slot-agnostic delivery

The daemon's cache holds `CachedSlot[]` (discriminated union of ad + news, see [Slot Content](../architecture/slot-content.md)). The orchestrator's `pickNextSlot` returns the next item; render branches on `slot.kind` in `display.ts` with an exhaustiveness check.

Ad-only side effects (campaign cap, hourly/daily fatigue caps, ad ledger writes, click tracking, viewability beacons) are gated on `slot.kind === "ad"`. News slots write to a separate `news_impressions_pending` SQLite table and sync via the same `/ingest` POST.

The save keybind `b` writes to `reading_pending` (local SQLite) and syncs to `/me/reading`.

## What's next

- **`distro doctor`** — checks heartbeat age, hooks, backend reachability.
- **`distro demo`** — `[DEMO]` badge + vanish-timing stats.
