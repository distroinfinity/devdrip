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

## Known limitations (MVP)

- **Last-writer-wins tty.** A user running Claude in two terminals will only see ads in whichever one last sent `idle-start`. Tracked; supporting concurrent ttys requires a `ttyPath → state` map.
- **No alt-screen buffer.** Ads render at the current cursor position and vanish via `\x1b[<n>A\x1b[0J`. If another process writes to the same tty between show and vanish, the cursor-math is wrong. In practice agent output is paused during tool calls, which is when ads show. Alt-screen handling can be layered on later without touching the state machine.
- **No hook auto-restart.** A stale daemon means hooks silently exit 0. `devdrip daemon start` restarts it. Auto-restart belongs to `devdrip doctor` (S5-02).

## What's next

- **S3-01 ANSI box renderer** — upgrades `renderBox()` to width-adaptive + source badge + progress bar. No change to the daemon's display I/O.
- **S3-03 Key capture** — adds a raw-tty stdin reader active only during SHOWING, emitting `skip | kill | mute | discover` events through the existing state machine.
- **S3-07 Auto-sync + devdrip sync** — reads the ledger, chunks, POSTs, marks synced, prunes. The daemon exposes `orchestrator` + `ledger` refs so the sync loop can inject into the same process.
- **S5-02 doctor** — checks heartbeat age and offers to restart.
- **S5-04 devdrip demo** — `[DEMO]` badge + vanish-timing stats.
