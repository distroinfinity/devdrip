# CH 03 — Utilities (dev instrument panel)

CH 03 is a third rotating slot alongside **CH 01 NEWS** and **CH 02 MARKETS**.
Where those surface _external_ feeds, Utilities is _inward-looking_: a compact
instrument panel of local, real-time stats a developer wants to glance at while
Claude Code works — Claude usage/limits, git state, machine vitals, and service
health. It rotates in the same flow (news → markets → utils → …).

Unlike news/ticker slots, the utility slot is **built locally by the daemon**
every time it's that slot's turn — it never round-trips `/me/content/next`, and
usage/cost data never leaves the machine.

## The telemetry feed (and the status-line fix it rode in on)

Claude Code pipes a rich JSON blob to its `statusLine` command on stdin every
render: `rate_limits.five_hour/.seven_day.{used_percentage,resets_at}`,
`context_window.{used_percentage,context_window_size}`, `cost.total_cost_usd`,
cache token counts, `model.display_name`, `effort.level`, and
`workspace.current_dir`. We previously discarded this.

`distro statusline` now parses it into a local snapshot
(`~/.distro/claude-usage.json`, latest fields + a short rolling history) which
the utility slot reads. See `lib/claude-usage.ts`.

### Status-line chaining (append, never clobber)

Claude Code's `statusLine` is a **single command slot**. When Distro takes it
over, `setStatusLine` (`lib/claude-settings.ts`) now first stashes any
pre-existing user command in `~/.distro/wrapped-statusline.json`
(`lib/wrapped-statusline.ts`). `distro statusline` then:

1. snapshots the stdin telemetry,
2. runs the wrapped command (feeding it the same stdin, 800 ms timeout) and
   emits its output,
3. appends our current slot line **below** it.

`removeStatusLine` (uninstall) restores the wrapped command instead of deleting
the entry. Net effect: a user's custom status line keeps working untouched, with
the Distro line added beneath it.

## Buckets

All buckets are optional — an unavailable source is omitted, never shown as a
fake zeroed gauge (`UtilityPayload` in `@distrotv/shared`).

| Bucket      | Source                                               | Fields                                                                                        |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **ai**      | statusline snapshot + derived history                | 5h/7d limit % + reset, ctx %, cost, cache %, burn $/min, time-to-limit, model/effort, lines ± |
| **git**     | `git` in the snapshot's `cwd` (cached 10 s)          | branch, ahead/behind, dirty files, uncommitted lines, last-commit age                         |
| **machine** | `os` + `pmset` + `statfs` (cached 15 s)              | cpu %, mem %, battery %, disk free %                                                          |
| **health**  | status.anthropic.com summary + latency (cached 60 s) | Anthropic status (ok/degraded/down), API latency, online                                      |

Burn rate and time-to-limit are derived from the rolling cost/limit history in
`deriveUsage`.

## Generation & rotation

`createUtilityProvider` (`lib/utility-slot.ts`) caches probe results and
refreshes stale ones **in the background** so `build()` stays synchronous and
fast. The orchestrator (`lib/daemon/orchestrator.ts`) injects a utility slot
every `UTILITY_SLOT_EVERY_N` (=3) non-suppressed picks, gated on the
`utilitiesEnabled` pref. If the provider has no data yet (cold start, no Claude
session), `build()` returns `null` and the rotation falls through to a normal
slot rather than skipping a beat.

The slot is tagged `cacheSource: "local"`; the orchestrator skips the
`writeNowPlaying` API mirror for it, so usage data stays on-device.

## Layout — the instrument-panel grid

`renderUtilityPanel` (`render-line.ts`) draws three rows on **one shared
4-column grid**, so bars line up vertically and the `│` separators run straight
down. Each column owns a hue (fill + a dark "unfilled" track tint):

```
▍ utils · live
⎇ organic-bread ↑3 ↓1 · 5 dirty │ $0.29 · $0.19/m · ~5m │ Opus 4.8 / high │ ⚠ api degraded
7d  ███░░░░░ 22% · 6d            │ ctx ███░░░░░ 41%      │ cache ██████░ 79% │ 5h ███░░ 36% · 1h 9m
cpu ██░░░░░░ 30                  │ mem ████████ 99       │ disk █████░░ 57   │ batt ████████ 100
distro tv · utils
```

- **col 1 · teal** — 7d limit (gauge) / git: `⎇ branch ↑ahead ↓behind · N dirty`
- **col 2 · amber** — ctx (gauge) / cost · burn · `~time-to-limit`
- **col 3 · violet** — cache (gauge) / model · effort
- **col 4 · periwinkle** — 5h limit (gauge) / **api line only on an incident**
- machine row (cpu/mem/disk/batt) uses gray bars; **mem turns red ≥90%**

Per-column label fields (`COL_FIELD`) are uniform so every bar starts at the same
x in its column. Bars turn red + `⚠` at/above `UTILITY_LIMIT_WARN_PCT` (90%, for
5h/7d) and `UTILITY_CTX_WARN_PCT` (90%, ctx). The **API health line is hidden
when Anthropic is healthy** and only appears (red) during a `degraded`/`down`
incident.

Bar width scales with the terminal width the daemon reads off the tty, and the
panel degrades progressively on narrow terminals: full → drop machine row → drop
context detail → **gauges-only** (the four core gauges always fit). Absent
buckets (no git repo, stale snapshot) are omitted, never shown as zeroed bars.

The `utilitiesLayout` pref (`auto`/`full`/`complement`) and the `layout` field on
`UtilityPayload` are retained but the renderer currently draws the same grid
regardless — bars are always shown, including when appended below a user's own
status line.

## Preferences

`distro preferences` → **utilities panel** toggles `utilitiesEnabled` and picks
the layout. Both are CLI-local (never uploaded), so they write straight to the
config file. The daemon reads `utilitiesLayout` live via the file-watch reload —
no restart needed.

## Out of scope (v1)

Backend sync / dashboard usage history; a persistent always-on grid; cross-tool
(Cursor/Copilot) aggregation. CI/build + deploy status are reserved for their own
future channels.
