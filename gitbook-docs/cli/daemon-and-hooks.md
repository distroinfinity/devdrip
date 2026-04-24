# Daemon + Hook IPC

Fills the last structural gap in the CLI: PreToolUse → 3s grace → ad on screen → impression in the ledger. Implementation of S2-10 (Daemon process) and S2-11 (Hook commands).

## Process model

- **`devdrip daemon start`** — verifies config, probes for a live socket, spawns `devdrip daemon run` detached (`stdio: ignore → daemon.log`, `unref()`). Idempotent: running twice from the same user prints `daemon already running (pid N)` and exits 0.
- **`devdrip daemon run`** — foreground loop. Acquires PID-file singleton at `~/.devdrip/daemon.lock`, binds unix socket, starts the heartbeat timer, loads config + ledger + ad-cache, enters the event loop.
- **`devdrip daemon stop`** — sends a `{"type":"kill"}` JSON message over the socket. Falls back to SIGTERM, then SIGKILL.
- **`devdrip daemon status`** — reads `~/.devdrip/daemon.heartbeat`. No socket round-trip.

## Runtime files (`~/.devdrip/`, mode 0700)

| File               | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `daemon.sock`      | unix socket (mode 0600)                                |
| `daemon.lock`      | PID-file singleton (mode 0600)                         |
| `daemon.heartbeat` | JSON, written every 10s, atomic tmp+rename (mode 0600) |
| `daemon.log`       | append-only plaintext (mode 0600, no rotation for MVP) |

macOS long-username fallback: if `sun_path` (104 bytes) would overflow, the daemon binds `/tmp/devdrip-<uid>.sock` instead. The chosen path is always recorded in `daemon.heartbeat.socketPath` so `devdrip daemon stop` doesn't need to re-derive it.

## Wire protocol

Newline-delimited JSON, hook → daemon, fire-and-forget:

```
{"type":"session-start"}
{"type":"idle-start","tty":"/dev/ttys003"}
{"type":"idle-end"}
```

Plus one control event from `devdrip daemon stop`:

```
{"type":"kill"}
```

Key-capture (S3-03) emits `skip | kill | mute | discover | dismiss` from the daemon's raw-tty stdin reader, not from a hook. Unknown event types are logged and dropped.

## Hook subcommand ↔ wire event mapping

The ticket body uses `idle-start` as both the subcommand and the event. The code splits them:

| Claude hook event | CLI subcommand               | Wire event      |
| ----------------- | ---------------------------- | --------------- |
| SessionStart      | `devdrip hook session-start` | `session-start` |
| UserPromptSubmit  | `devdrip hook prompt-submit` | `idle-start`    |
| PreToolUse        | `devdrip hook pre-tool`      | `idle-start`    |
| Stop              | `devdrip hook stop`          | `idle-end`      |

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

- **Header**: `DEV DRIP TV` + cumulative `$X.XXXX earned` on the left, `via {source}` on the right. Right segment is dropped automatically when terminal width is too tight to fit both without breaking alignment.
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

CLI fallbacks (`devdrip skip|mute|kill-session|discover`) dispatch the same wire actions for users whose keystrokes lose the tty race with Claude.

## Anchor strategy (real-session hardening)

Earlier MVP rendered at the cursor and vanished via `\x1b[<n>A\x1b[0J`. That broke the moment Claude Code redrew its TUI between show and vanish — ad fragments interleaved with Claude's box-drawing.

`packages/cli/src/lib/daemon/display.ts` now uses **DECSTBM** (Set Top and Bottom Margins, `\x1b[1;<scrollBottom>r`) to carve the screen into two regions:

- Upper region (rows 1..scrollBottom): Claude's scroll buffer.
- Lower region (scrollBottom+1..rows): the ad pane. Cleared with `\x1b[0J` after `\x1b7` cursor-save and re-anchored on every render with `\x1b8` cursor-restore so Claude's prompt position survives.

On terminal resize, the daemon proactively dismisses the current ad (the next rotation re-anchors with fresh row counts).

## Frequency caps (defaults)

Defaults bias toward "show ads aggressively"; users dial down with `devdrip config --set maxPerHour=N`:

| Constant                         | Value                |
| -------------------------------- | -------------------- |
| `MAX_ADS_PER_HOUR_PER_SURFACE`   | `9_999`              |
| `MAX_ADS_PER_HOUR_TOTAL`         | `9_999`              |
| `MAX_ADS_PER_DAY`                | `99_999`             |
| `MAX_ADS_PER_CONTINUOUS_SESSION` | `9_999`              |
| `SESSION_WARMUP_MS`              | `0`                  |
| `LATE_NIGHT_FREQUENCY_REDUCTION` | `1.0` (no reduction) |
| `INTER_AD_GAP_MS`                | `500`                |

Quiet hours and `nightMode` remain available as opt-in throttles.

## Known limitations (MVP)

- **Last-writer-wins tty.** A user running Claude in two terminals will only see ads in whichever one last sent `idle-start`. Tracked; supporting concurrent ttys requires a `ttyPath → state` map.
- **DECSTBM only.** If the host TUI switches to the alternate screen buffer (`\x1b[?1049h`), the scroll region is discarded and the ad anchor is lost. Modern Claude Code stays on the primary screen during tool calls, so this is fine in practice.
- **Raw mode persists across stop.** `setRawMode(false)` is deliberately NOT called in `input.ts:stop()` because Claude Code owns its REPL's raw-mode setting and toggling it broke Claude's stdin. SIGKILL recovery still requires `reset` if the terminal is left in raw mode.
- **No hook auto-restart.** A stale daemon means hooks silently exit 0. `devdrip daemon start` restarts it. Auto-restart belongs to `devdrip doctor` (S5-02).

## What's next

- **S3-07 Auto-sync + `devdrip sync`** — reads the ledger, chunks, POSTs, marks synced, prunes. The daemon exposes `orchestrator` + `ledger` refs so the sync loop can inject into the same process.
- **S5-02 `devdrip doctor`** — checks heartbeat age and offers to restart.
- **S5-04 `devdrip demo`** — `[DEMO]` badge + vanish-timing stats.
