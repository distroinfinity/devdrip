# Slot rendering

The CLI daemon dispatches by `slot.kind` to one of two renderers:

- **News (`renderNewsBox`)** — single headline + source/age/score line + footer hotkeys. M3.
- **Ticker (`renderTickerBox`)** — layout B: header row, price + sparkline + 1m label, stats row (d1/w1/m1/52w), footer hotkeys. M4.

## Rendering model: Claude Code statusLine (cli-v0.2.6+)

**The daemon never writes to the user's TTY.** Two programs driving the same terminal is what corrupted Claude Code's screen, and the interim inline-append fix (0.2.4–0.2.5) spammed the scrollback with one box per rotation. The only way to pin a slot at the bottom that _coexists_ with Claude Code is to let **Claude render it** — via its native `statusLine` hook.

Flow:

1. The daemon's `showAd` (`packages/cli/src/lib/daemon/display.ts`) renders a **colored, multi-line panel** (`renderSlotLine` in `lib/render-line.ts`) and publishes it to a local file `~/.distro/now-playing.json` (`lib/statusline-state.ts`, `{ line, ts }`). `showAd` reads the terminal width off the tty path so the panel can right-align price/change/age across the available space. **No terminal writes at all.**
2. `distro statusline` (`commands/statusline.ts`) reads that file — printing the panel, or nothing when the entry is older than the 5-min staleness TTL — and exits fast. Claude pipes session JSON on stdin (ignored).
3. `distro init` wires Claude Code's `statusLine` to that command via `setStatusLine` (`lib/claude-settings.ts`):

```json
"statusLine": { "type": "command", "command": "<distro-bin> statusline", "padding": 0 }
```

Claude Code owns the bottom line, polls the command on its own cadence, and renders the result in place — zero TTY contention, no scrollback spam, replaced each rotation. `uninstall` strips the entry (only if it's ours) via `removeStatusLine`.

Panel format (truecolor; reuses `ansi` tokens, `renderChip` brand badges, and the `sparkline` braille chart — left-to-right with the price/change/age right-aligned to the read width; Claude truncates over-wide lines):

```
▍ news · live
  ‹BBG› Bloomberg · ↑ 418                                    2h
  BlackRock's Saigal Sees 'Sufficient Factors' to Justify Fed Cuts   (wraps to 2 lines when long)
  distro tv · news

▍ markets · live
  ‹AAPL› Apple Inc                          $308.82   ▲ +1.26%
  ⣀⣀⡠⠤⠤⠒⠒⠉⠉  1M
  day +1.30%  ·  wk +3.30%  ·  mo +12.90%               52w 195–311
  distro tv · markets
```

The orchestrator still drives its show / vanish / progress timers (for rotation + impression accounting), so the `DisplayHandle` keeps its shape but `flash` / `updateProgress` / `flashHeader` / `shiftChart` / `onResize` are no-ops; `vanish` is a no-op too — the panel **persists between rotations** (the daemon clears the file only on clean shutdown; the TTL guards the rest). The multi-line box renderers (`renderNewsBox`, `renderTickerBox`) remain for `distro demo`.

**Timing:** every slot (news + ticker) shows for `MAX_AD_DURATION_MS` (12s) then rotates after `INTER_AD_GAP_MS` (0.5s). News no longer uses its server `displayTimeMs` (the daemon overrides both kinds to one rate).

The `as` casts elsewhere are for the `cacheSource` field on `CachedSlot` and the future `sponsored`/`portfolio` kinds in the `SlotKind` enum that don't have payload types yet.

## Layout B (single ticker)

```
╔═ ● DISTRO TV · 📈 AAPL ═══════════════════════ EQUITY ═╗
║                                                          ║
║  AAPL  $234.56  ▲ +2.34%   ▁▂▂▃▅▆▆▇█▇▆▅▆▇ 1m            ║
║  1d +2.3%  1w +5.1%  1m -1.2%  52w 165-237              ║
║                                                          ║
║  [O]pen  [C]hart  [N]ext  [W]atchlist  [S]kip  [K]ill  [M]ute       ║
╚══════════════════════════════════════════════════════════╝
```

Width is clamped 40-120 cols. ASCII fallback (`+` `-` `|`) when not a TTY (piped output, CI). Arrow is `▲` for non-negative `changePct`, `▼` otherwise; the `+` sign is added for non-negative percentages (the `-` is already on the number).

## Sparkline

`packages/cli/src/lib/sparkline.ts` is a pure block-glyph renderer:

```ts
sparkline(values: number[], width: number): string
```

Block alphabet: `▁▂▃▄▅▆▇█`. Resamples by nearest-neighbor index (`Math.floor((i * values.length) / width)`). Edge cases:

- `width === 0` → empty string
- `values === []` → `width` spaces
- `values.length === 1` or all-equal series → flat mid-block (`▄`-repeat)
- normal series → min/max scaled across the 8 blocks

Six unit tests in `__tests__/sparkline.test.ts` pin these invariants.

## Hotkey map

Same set of hotkeys regardless of slot kind (M5 will add alert behavior):

| key   | news                        | ticker                         |
| ----- | --------------------------- | ------------------------------ |
| `O`   | open story                  | open ticker page               |
| `C`   | —                           | open chart at `/chart/<sym>`   |
| `B`   | save story                  | add ticker to active watchlist |
| `N`   | next                        | next ticker in rotation        |
| `S`   | skip                        | skip                           |
| `K`   | kill all slots this session | same                           |
| `M`   | mute 30 min                 | same                           |
| `Esc` | dismiss                     | dismiss                        |

Layout C (multi-ticker grid) is in the cut-order #2 — deferred until needed.
